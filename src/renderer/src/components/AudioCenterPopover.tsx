import { useEffect, useMemo, useState } from 'react'
import { Headphones, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'
import type { AudioCenterCommand, AudioCenterSession } from '../../../shared/contracts/browser'

export function AudioCenterPopover(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<AudioCenterSession[]>([])

  useEffect(() => {
    const unsubscribe = window.devBrowser.audio.onSessionsChanged(setSessions)
    void window.devBrowser.audio.getSessions().then(setSessions).catch(console.error)
    return unsubscribe
  }, [])

  const activeCount = sessions.filter((session) => session.state === 'playing' || session.state === 'muted').length

  function run(command: AudioCenterCommand): void {
    void window.devBrowser.audio.command(command).catch(console.error)
  }

  function goToSource(sessionId: string): void {
    void window.devBrowser.audio.goToSource(sessionId).then(() => setOpen(false)).catch(console.error)
  }

  return <div className="audio-center">
    <button type="button" className={`audio-center-trigger${open ? ' is-active' : ''}${activeCount > 0 ? ' has-media' : ''}`} aria-label="Audio Center" data-tooltip="Audio Center" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Headphones size={16} strokeWidth={1.75} aria-hidden="true" />
      {activeCount > 0 && <span>{activeCount}</span>}
    </button>
    {open && <section className="audio-center-popover" aria-label="Audio Center">
      <header>
        <div>
          <strong>Audio Center</strong>
          <span>{sessions.length === 0 ? 'Nenhuma mídia ativa' : `${sessions.length} sessão${sessions.length === 1 ? '' : 's'} de mídia`}</span>
        </div>
      </header>
      <div className="audio-center-list">
        {sessions.length === 0 ? <p>Nada tocando agora.</p> : sessions.map((session) => <AudioSessionCard key={session.id} session={session} onCommand={run} onGoToSource={goToSource} />)}
      </div>
    </section>}
  </div>
}

function AudioSessionCard({ session, onCommand, onGoToSource }: { session: AudioCenterSession; onCommand: (command: AudioCenterCommand) => void; onGoToSource: (sessionId: string) => void }): React.JSX.Element {
  const progress = useMemo(() => {
    if (!session.duration || session.currentTime === null) return 0
    return Math.min(100, Math.max(0, (session.currentTime / session.duration) * 100))
  }, [session.currentTime, session.duration])
  const playing = session.state === 'playing'
  const status = session.state === 'muted' ? 'Mutado' : playing ? 'Reproduzindo' : 'Pausado'

  return <article className="audio-session-card">
    <div className="audio-session-art">
      {session.artwork ? <img src={session.artwork} alt="" /> : session.favicon ? <img src={session.favicon} alt="" /> : <Headphones size={24} strokeWidth={1.5} aria-hidden="true" />}
    </div>
    <div className="audio-session-main">
      <div className="audio-session-heading">
        <div>
          <strong>{session.title}</strong>
          <span>{session.artist || session.domain || 'Mídia da página'}</span>
        </div>
        <span className={`audio-session-state is-${session.state}`}>{status}</span>
      </div>
      <div className="audio-session-origin">
        <span>{session.workspaceName}</span>
        <span>{session.deviceName ? `${session.tabTitle} / ${session.deviceName}` : session.tabTitle}</span>
      </div>
      <div className="audio-session-controls" aria-label={`Controles de ${session.title}`}>
        <button type="button" aria-label="Retroceder 10 segundos" data-tooltip="Retroceder 10s" disabled={!session.supportsSeek} onClick={() => onCommand({ sessionId: session.id, action: 'seek-backward' })}><RotateCcw size={14} aria-hidden="true" /></button>
        <button type="button" aria-label={playing ? 'Pausar' : 'Reproduzir'} data-tooltip={playing ? 'Pausar' : 'Reproduzir'} disabled={!session.supportsPlayPause} onClick={() => onCommand({ sessionId: session.id, action: playing ? 'pause' : 'play' })}>{playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
        <button type="button" aria-label="Avançar 10 segundos" data-tooltip="Avançar 10s" disabled={!session.supportsSeek} onClick={() => onCommand({ sessionId: session.id, action: 'seek-forward' })}><RotateCw size={14} aria-hidden="true" /></button>
        <button type="button" aria-label={session.muted ? 'Ativar áudio' : 'Mutar'} data-tooltip={session.muted ? 'Ativar áudio' : 'Mutar'} onClick={() => onCommand({ sessionId: session.id, action: session.muted ? 'unmute' : 'mute' })}>{session.muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}</button>
        <button type="button" className="audio-session-goto" onClick={() => onGoToSource(session.id)}>Ir para aba</button>
      </div>
      {session.live ? <div className="audio-session-live">AO VIVO</div> : <div className="audio-session-progress">
        <span>{formatTime(session.currentTime)}</span>
        <input aria-label="Progresso da mídia" type="range" min={0} max={session.duration ?? 0} step={1} value={session.currentTime ?? 0} disabled={!session.supportsSeek || !session.duration} style={{ '--audio-progress': `${progress}%` } as React.CSSProperties} onChange={(event) => onCommand({ sessionId: session.id, action: 'seek', position: Number(event.currentTarget.value) })} />
        <span>{formatTime(session.duration)}</span>
      </div>}
      {session.pageScoped && <small className="audio-session-note">Controles aplicados ao player HTML5 principal desta página.</small>}
    </div>
  </article>
}

function formatTime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--:--'
  const total = Math.max(0, Math.floor(value))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
