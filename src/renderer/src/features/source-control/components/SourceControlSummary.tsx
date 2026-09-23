import { useEffect, useState } from 'react'
import { FolderGit2, Github } from 'lucide-react'
import { useSourceControlStore } from '../stores/sourceControlStore'
import type { GitHubProviderStatus } from '../types'

type Props = {
  onOpen: () => void
}

export function SourceControlSummary({ onOpen }: Props): React.JSX.Element {
  const { status, setStatus } = useSourceControlStore()
  const [githubStatus, setGitHubStatus] = useState<GitHubProviderStatus | null>(null)
  const repository = status?.repository ?? null
  const changeCount = status ? status.counts.modified + status.counts.added + status.counts.deleted + status.counts.untracked : 0
  const githubName = githubStatus?.state === 'connected'
    ? githubStatus.displayName ?? (githubStatus.username ? `@${githubStatus.username}` : 'Connected')
    : githubStatus?.state === 'connecting'
      ? 'Connecting'
      : 'Not signed in'

  useEffect(() => {
    let cancelled = false
    async function refresh(): Promise<void> {
      try {
        const [nextStatus, nextGitHubStatus] = await Promise.all([
          window.devBrowser.sourceControl.getStatus().catch(() => null),
          window.devBrowser.github.getStatus().then((state) => state.state === 'connected' ? window.devBrowser.github.refreshProfile() : state).catch(() => null)
        ])
        if (cancelled) return
        if (nextStatus) setStatus(nextStatus)
        setGitHubStatus(nextGitHubStatus)
      } catch (error) {
        console.error('Failed to refresh source control summary', error)
      }
    }
    void refresh()
    return () => { cancelled = true }
  }, [setStatus])

  return <section className="source-control-summary" aria-label="Source control summary">
    <button type="button" className="source-control-summary-row" onClick={onOpen}>
      <FolderGit2 size={14} aria-hidden="true" />
      <span>Project</span>
      <strong title={repository?.rootPath ?? undefined}>{repository?.available ? repository.name : repository ? `${repository.name} unavailable` : 'None'}</strong>
      {changeCount > 0 && <em>{changeCount}</em>}
    </button>
    <button type="button" className="source-control-summary-row" onClick={onOpen}>
      <Github size={14} aria-hidden="true" />
      <span>GitHub</span>
      <strong title={githubStatus?.username ?? githubName}>{githubName}</strong>
    </button>
  </section>
}
