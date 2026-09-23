import { type BrowserWindow, type WebContents } from 'electron'
import { browserChannels, type AudioCenterCommand, type AudioCenterSession, type AudioCenterTarget } from '../../shared/contracts/browser'

type MediaTarget = AudioCenterTarget & {
  id: string
  contents: WebContents
  listeners: {
    audioStateChanged: () => void
    destroyed: () => void
    navigation: () => void
    title: () => void
  }
  lastPlayerIndex: number
}

export class AudioCenter {
  private readonly targets = new Map<string, MediaTarget>()
  private readonly sessions = new Map<string, AudioCenterSession>()
  private progressTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly window: BrowserWindow,
    private readonly setTabMuted: (workspaceId: string, tabId: string, muted: boolean) => void,
    private readonly selectSource: (workspaceId: string, tabId: string, deviceId: string | null) => void
  ) {}

  register(target: AudioCenterTarget, contents: WebContents | null): void {
    const id = sourceId(target)
    if (!contents || contents.isDestroyed()) {
      this.unregister(id)
      return
    }
    const existing = this.targets.get(id)
    if (existing?.contents.id === contents.id) {
      this.targets.set(id, { ...existing, ...target, id, contents })
      void this.refreshTarget(id)
      return
    }
    this.unregister(id)
    const audioStateChanged = (): void => { void this.refreshTarget(id) }
    const destroyed = (): void => this.unregister(id)
    const navigation = (): void => { void this.refreshTarget(id) }
    const title = (): void => { void this.refreshTarget(id) }
    contents.on('audio-state-changed', audioStateChanged)
    contents.on('destroyed', destroyed)
    contents.on('did-finish-load', navigation)
    contents.on('did-navigate', navigation)
    contents.on('did-navigate-in-page', navigation)
    contents.on('page-title-updated', title)
    this.targets.set(id, { ...target, id, contents, listeners: { audioStateChanged, destroyed, navigation, title }, lastPlayerIndex: 0 })
    if (contents.isCurrentlyAudible()) void this.refreshTarget(id)
  }

  updateMuted(workspaceId: string, tabId: string, muted: boolean): void {
    let changed = false
    for (const [id, target] of this.targets) {
      if (target.workspaceId !== workspaceId || target.tabId !== tabId) continue
      this.targets.set(id, { ...target, muted })
      changed = true
    }
    if (changed) {
      for (const [id, session] of this.sessions) {
        if (session.workspaceId === workspaceId && session.tabId === tabId) this.sessions.set(id, { ...session, muted, state: muted ? 'muted' : session.state === 'muted' ? 'paused' : session.state })
      }
      this.emit()
    }
  }

  snapshot(): AudioCenterSession[] {
    return [...this.sessions.values()].sort((left, right) => left.workspaceName.localeCompare(right.workspaceName) || left.tabTitle.localeCompare(right.tabTitle))
  }

  async command(command: AudioCenterCommand): Promise<void> {
    const session = this.sessions.get(command.sessionId)
    if (!session) throw new Error('Media session is unavailable')
    const target = this.targets.get(command.sessionId)
    if (!target || target.contents.isDestroyed()) throw new Error('Media target is unavailable')
    if (command.action === 'mute' || command.action === 'unmute') {
      this.setTabMuted(target.workspaceId, target.tabId, command.action === 'mute')
      return
    }
    const result = await target.contents.executeJavaScript(controlScript(command, target.lastPlayerIndex), true) as MediaControlResult
    if (result?.ok && typeof result.index === 'number') target.lastPlayerIndex = result.index
    await this.refreshTarget(target.id)
  }

  goToSource(sessionId: string): AudioCenterSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    this.selectSource(session.workspaceId, session.tabId, session.deviceId)
    return session
  }

  dispose(): void {
    for (const id of [...this.targets.keys()]) this.unregister(id)
    this.sessions.clear()
    this.stopProgressTimer()
  }

  private unregister(id: string): void {
    const target = this.targets.get(id)
    if (!target) return
    const { contents, listeners } = target
    contents.removeListener('audio-state-changed', listeners.audioStateChanged)
    contents.removeListener('destroyed', listeners.destroyed)
    contents.removeListener('did-finish-load', listeners.navigation)
    contents.removeListener('did-navigate', listeners.navigation)
    contents.removeListener('did-navigate-in-page', listeners.navigation)
    contents.removeListener('page-title-updated', listeners.title)
    this.targets.delete(id)
    if (this.sessions.delete(id)) this.emit()
  }

  private async refreshTarget(id: string): Promise<void> {
    const target = this.targets.get(id)
    if (!target || target.contents.isDestroyed()) {
      this.unregister(id)
      return
    }
    if (!target.contents.isCurrentlyAudible() && !this.sessions.has(id)) return
    let details: MediaPageDetails | null = null
    try {
      details = await target.contents.executeJavaScript(mediaDetailsScript(), true) as MediaPageDetails
    } catch {
      details = null
    }
    if (!details || details.playerCount === 0 || (!details.hasActiveMedia && !target.contents.isCurrentlyAudible())) {
      if (this.sessions.delete(id)) this.emit()
      return
    }
    if (typeof details.index === 'number') target.lastPlayerIndex = details.index
    const session: AudioCenterSession = {
      id,
      kind: target.kind,
      workspaceId: target.workspaceId,
      workspaceName: target.workspaceName,
      tabId: target.tabId,
      tabTitle: target.tabTitle,
      deviceId: target.deviceId,
      deviceName: target.deviceName,
      url: target.url || target.contents.getURL(),
      domain: domainFor(target.url || target.contents.getURL()),
      favicon: target.favicon,
      title: details.title || target.tabTitle || target.contents.getTitle() || domainFor(target.url || target.contents.getURL()),
      artist: details.artist || null,
      artwork: details.artwork || null,
      state: target.muted ? 'muted' : details.playing ? 'playing' : 'paused',
      muted: target.muted,
      currentTime: details.currentTime,
      duration: details.live ? null : details.duration,
      live: details.live,
      supportsPlayPause: details.supportsPlayPause,
      supportsSeek: details.supportsSeek,
      playerCount: details.playerCount,
      pageScoped: details.playerCount > 1
    }
    this.sessions.set(id, session)
    this.ensureProgressTimer()
    this.emit()
  }

  private ensureProgressTimer(): void {
    if (this.progressTimer || this.sessions.size === 0) return
    this.progressTimer = setInterval(() => {
      if (this.sessions.size === 0) {
        this.stopProgressTimer()
        return
      }
      for (const id of this.sessions.keys()) void this.refreshTarget(id)
    }, 1000)
  }

  private stopProgressTimer(): void {
    if (!this.progressTimer) return
    clearInterval(this.progressTimer)
    this.progressTimer = null
  }

  private emit(): void {
    if (this.sessions.size === 0) this.stopProgressTimer()
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send(browserChannels.audioSessionsChanged, this.snapshot())
  }
}

type MediaPageDetails = {
  index: number
  playerCount: number
  hasActiveMedia: boolean
  playing: boolean
  title: string
  artist: string
  artwork: string | null
  currentTime: number | null
  duration: number | null
  live: boolean
  supportsPlayPause: boolean
  supportsSeek: boolean
}

type MediaControlResult = { ok: boolean; index?: number }

function sourceId(target: Pick<AudioCenterTarget, 'workspaceId' | 'kind' | 'tabId' | 'deviceId'>): string {
  return `${target.workspaceId}:${target.kind}:${target.tabId}:${target.deviceId ?? 'page'}`
}

function domainFor(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function mediaDetailsScript(): string {
  return `(() => {
    const media = [...document.querySelectorAll('audio,video')].filter((item) => item instanceof HTMLMediaElement);
    const candidates = media.map((item, index) => ({
      item,
      index,
      score: (!item.paused && !item.ended ? 100 : 0) + (item.currentTime > 0 ? 20 : 0) + (item.duration ? 5 : 0)
    })).sort((left, right) => right.score - left.score);
    const best = candidates[0];
    const item = best?.item ?? null;
    const metadata = navigator.mediaSession?.metadata ?? null;
    const artwork = metadata?.artwork?.length ? metadata.artwork[metadata.artwork.length - 1]?.src ?? null : null;
    const duration = item && Number.isFinite(item.duration) && item.duration > 0 ? item.duration : null;
    const live = Boolean(item && (!Number.isFinite(item.duration) || item.duration === Infinity) && !duration);
    const supportsSeek = Boolean(item && duration && item.seekable && item.seekable.length > 0);
    return {
      index: best?.index ?? 0,
      playerCount: media.length,
      hasActiveMedia: Boolean(item && (!item.paused || item.currentTime > 0 || item.ended)),
      playing: Boolean(item && !item.paused && !item.ended),
      title: metadata?.title || document.title || '',
      artist: metadata?.artist || metadata?.album || '',
      artwork,
      currentTime: item ? Math.max(0, item.currentTime || 0) : null,
      duration,
      live,
      supportsPlayPause: Boolean(item),
      supportsSeek
    };
  })()`
}

function controlScript(command: AudioCenterCommand, preferredIndex: number): string {
  const position = Number.isFinite(command.position) ? command.position : 0
  return `(() => {
    const media = [...document.querySelectorAll('audio,video')].filter((item) => item instanceof HTMLMediaElement);
    const preferred = media[${JSON.stringify(preferredIndex)}];
    const item = preferred || media.find((candidate) => !candidate.paused && !candidate.ended) || media[0];
    const index = item ? media.indexOf(item) : -1;
    if (!item) return { ok: false };
    try {
      if (${JSON.stringify(command.action)} === 'play') {
        const result = item.play();
        if (result && typeof result.catch === 'function') result.catch(() => {});
        return { ok: true, index };
      }
      if (${JSON.stringify(command.action)} === 'pause') {
        item.pause();
        return { ok: true, index };
      }
      const duration = Number.isFinite(item.duration) && item.duration > 0 ? item.duration : null;
      const canSeek = Boolean(duration && item.seekable && item.seekable.length > 0);
      if (!canSeek) return { ok: false, index };
      if (${JSON.stringify(command.action)} === 'seek-forward') item.currentTime = Math.min(duration, item.currentTime + 10);
      if (${JSON.stringify(command.action)} === 'seek-backward') item.currentTime = Math.max(0, item.currentTime - 10);
      if (${JSON.stringify(command.action)} === 'seek') item.currentTime = Math.max(0, Math.min(duration, ${JSON.stringify(position)}));
      return { ok: true, index };
    } catch {
      return { ok: false, index };
    }
  })()`
}
