import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, Circle, ExternalLink, FilePlus2, FileX2, FolderGit2, GitBranch, Github, Minus, Plus, RefreshCw, X } from 'lucide-react'
import { useSourceControlStore } from '../stores/sourceControlStore'
import type { GitBranch as GitBranchInfo, GitCommit, GitFileDiff, GitFileStatus, GitHubActionsRunPage, GitHubIssuePage, GitHubIssueState, GitHubProviderStatus, GitHubPullRequestDetail, GitHubPullRequestPage, GitHubPullRequestState, GitHubRepositoryMetadata, GitStatusSummary } from '../types'

const statusLabel: Record<GitFileStatus['status'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: 'U',
  conflicted: '!'
}

const githubStatusLabel: Record<GitHubProviderStatus['state'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error'
}

type SourceSectionKey = 'branches' | 'staged' | 'changes' | 'untracked' | 'history'
type PullRequestCreateFormState = { title: string; body: string; base: string; head: string; confirmed: boolean; result: { title: string; url: string } | null; repository: string; disabled: boolean }
type PullRequestCreateFormActions = { setTitle: (value: string) => void; setBody: (value: string) => void; setBase: (value: string) => void; setHead: (value: string) => void; setConfirmed: (value: boolean) => void }

export function SourceControlPanel({ onOpenCommit, onOpenDiff }: { onOpenCommit: (commit: GitCommit) => void; onOpenDiff: (diff: GitFileDiff) => void }) {
  const { status, isLoading, error, setStatus, setLoading, setError } = useSourceControlStore()
  const [diffError, setDiffError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitResult, setCommitResult] = useState<string | null>(null)
  const [remoteResult, setRemoteResult] = useState<string | null>(null)
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [githubStatus, setGitHubStatus] = useState<GitHubProviderStatus | null>(null)
  const [githubRepository, setGitHubRepository] = useState<GitHubRepositoryMetadata | null>(null)
  const [githubRepositoryError, setGitHubRepositoryError] = useState<string | null>(null)
  const [pullRequests, setPullRequests] = useState<GitHubPullRequestPage | null>(null)
  const [pullRequestState, setPullRequestState] = useState<GitHubPullRequestState>('open')
  const [pullRequestError, setPullRequestError] = useState<string | null>(null)
  const [pullRequestDetail, setPullRequestDetail] = useState<GitHubPullRequestDetail | null>(null)
  const [pullRequestDetailNumber, setPullRequestDetailNumber] = useState<number | null>(null)
  const [pullRequestDetailLoading, setPullRequestDetailLoading] = useState(false)
  const [pullRequestDetailError, setPullRequestDetailError] = useState<string | null>(null)
  const [pullRequestTitle, setPullRequestTitle] = useState('')
  const [pullRequestBody, setPullRequestBody] = useState('')
  const [pullRequestBase, setPullRequestBase] = useState('')
  const [pullRequestHead, setPullRequestHead] = useState('')
  const [pullRequestConfirmed, setPullRequestConfirmed] = useState(false)
  const [pullRequestCreateResult, setPullRequestCreateResult] = useState<{ title: string; url: string } | null>(null)
  const [issues, setIssues] = useState<GitHubIssuePage | null>(null)
  const [issueState, setIssueState] = useState<GitHubIssueState>('open')
  const [issueError, setIssueError] = useState<string | null>(null)
  const [actionsRuns, setActionsRuns] = useState<GitHubActionsRunPage | null>(null)
  const [actionsError, setActionsError] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [branchError, setBranchError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<SourceSectionKey, boolean>>({
    branches: false,
    staged: false,
    changes: false,
    untracked: false,
    history: false
  })
  const repository = status?.repository ?? null
  const changeCount = status ? status.counts.modified + status.counts.added + status.counts.deleted + status.counts.untracked : 0
  const files = status?.changedFiles ?? []
  const stagedFiles = files.filter((file) => file.staged)
  const unstagedFiles = files.filter((file) => file.unstaged && !file.untracked)
  const untrackedFiles = files.filter((file) => file.untracked)
  const currentBranchName = status?.currentBranch?.name ?? ''
  const commits = status?.recentCommits ?? []
  const githubRemote = status?.githubRemote ?? null
  const remoteCount = status?.remotes.length ?? 0
  const upstream = status?.currentBranch?.upstream ?? null

  async function syncBranches(nextStatus?: GitStatusSummary): Promise<void> {
    if (!nextStatus?.repository?.available) {
      setBranches([])
      return
    }
    setBranches(await window.devBrowser.sourceControl.getBranches())
  }

  async function refreshGitHub(): Promise<void> {
    try {
      const status = await window.devBrowser.github.getStatus()
      setGitHubStatus(status.state === 'connected' ? await window.devBrowser.github.refreshProfile() : status)
    } catch {
      setGitHubStatus({
        state: 'error',
        username: null,
        displayName: null,
        avatarUrl: null,
        profileUrl: null,
        authorization: null,
        error: 'Could not read GitHub status.'
      })
    }
  }

  async function connectGitHub(): Promise<void> {
    try {
      setGitHubStatus(await window.devBrowser.github.startLogin())
    } catch (cause) {
      setGitHubStatus({
        state: 'error',
        username: null,
        displayName: null,
        avatarUrl: null,
        profileUrl: null,
        authorization: null,
        error: cause instanceof Error ? cause.message : 'Could not start GitHub login.'
      })
    }
  }

  async function cancelGitHubLogin(): Promise<void> {
    try {
      setGitHubStatus(await window.devBrowser.github.cancelLogin())
    } catch (cause) {
      console.error('Failed to cancel GitHub login', cause)
    }
  }

  async function disconnectGitHub(): Promise<void> {
    try {
      setGitHubStatus(await window.devBrowser.github.disconnect())
    } catch (cause) {
      setGitHubStatus((current) => current
        ? { ...current, state: 'error', error: cause instanceof Error ? cause.message : 'Could not disconnect GitHub.' }
        : current)
    }
  }

  async function openGitHubAuthorization(): Promise<void> {
    try {
      await window.devBrowser.github.openAuthorizationUrl()
    } catch (cause) {
      setGitHubStatus((current) => current
        ? { ...current, state: 'error', error: cause instanceof Error ? cause.message : 'Could not open GitHub authorization.' }
        : current)
    }
  }

  async function openGitHubProfile(): Promise<void> {
    try {
      await window.devBrowser.github.openProfile()
    } catch (cause) {
      setGitHubStatus((current) => current
        ? { ...current, state: 'error', error: cause instanceof Error ? cause.message : 'Could not open GitHub profile.' }
        : current)
    }
  }

  async function refreshGitHubRepository(nextStatus: GitStatusSummary): Promise<void> {
    const remote = nextStatus.githubRemote?.github
    setGitHubRepository(null)
    setGitHubRepositoryError(null)
    setPullRequests(null)
    setPullRequestError(null)
    setPullRequestDetail(null)
    setPullRequestDetailNumber(null)
    setPullRequestDetailError(null)
    setIssues(null)
    setIssueError(null)
    setActionsRuns(null)
    setActionsError(null)
    if (!remote) return
    try {
      setGitHubRepository(await window.devBrowser.github.getRepository({ owner: remote.owner, repository: remote.repository }))
      await loadPullRequests(nextStatus, pullRequestState, 1)
      await loadIssues(nextStatus, issueState, 1)
      await loadActionsRuns(nextStatus, 1)
    } catch (cause) {
      setGitHubRepositoryError(cause instanceof Error ? cause.message : 'Could not read GitHub repository.')
    }
  }

  async function loadPullRequests(nextStatus = status, state = pullRequestState, page = pullRequests?.page ?? 1): Promise<void> {
    const remote = nextStatus?.githubRemote?.github
    if (!remote) {
      setPullRequests(null)
      return
    }
    setPullRequestError(null)
    try {
      setPullRequests(await window.devBrowser.github.listPullRequests({ owner: remote.owner, repository: remote.repository, state, page, perPage: 10 }))
      setPullRequestDetail(null)
      setPullRequestDetailNumber(null)
    } catch (cause) {
      setPullRequestError(cause instanceof Error ? cause.message : 'Could not list pull requests.')
    }
  }

  async function loadPullRequestDetail(number: number): Promise<void> {
    const remote = status?.githubRemote?.github
    if (!remote) return
    setPullRequestDetailNumber(number)
    setPullRequestDetail(null)
    setPullRequestDetailError(null)
    setPullRequestDetailLoading(true)
    try {
      setPullRequestDetail(await window.devBrowser.github.getPullRequest({ owner: remote.owner, repository: remote.repository, number }))
    } catch (cause) {
      setPullRequestDetailError(cause instanceof Error ? cause.message : 'Could not read pull request.')
    } finally {
      setPullRequestDetailLoading(false)
    }
  }

  async function openPullRequestOnGitHub(url: string): Promise<void> {
    try {
      await window.devBrowser.navigation.openExternal(url)
    } catch (cause) {
      setPullRequestDetailError(cause instanceof Error ? cause.message : 'Could not open pull request on GitHub.')
    }
  }

  async function createPullRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const remote = status?.githubRemote?.github
    if (!remote) return
    setPullRequestDetailError(null)
    setPullRequestCreateResult(null)
    setPullRequestDetailLoading(true)
    try {
      const result = await window.devBrowser.github.createPullRequest({
        owner: remote.owner,
        repository: remote.repository,
        title: pullRequestTitle,
        body: pullRequestBody,
        base: pullRequestBase,
        head: pullRequestHead
      })
      setPullRequestCreateResult({ title: `#${result.number} ${result.title}`, url: result.url })
      setPullRequestConfirmed(false)
      await loadPullRequests(status, 'open', 1)
    } catch (cause) {
      setPullRequestDetailError(cause instanceof Error ? cause.message : 'Could not create pull request.')
    } finally {
      setPullRequestDetailLoading(false)
    }
  }

  async function loadIssues(nextStatus = status, state = issueState, page = issues?.page ?? 1): Promise<void> {
    const remote = nextStatus?.githubRemote?.github
    if (!remote) {
      setIssues(null)
      return
    }
    setIssueError(null)
    try {
      setIssues(await window.devBrowser.github.listIssues({ owner: remote.owner, repository: remote.repository, state, page, perPage: 10 }))
    } catch (cause) {
      setIssueError(cause instanceof Error ? cause.message : 'Could not list issues.')
    }
  }

  async function openIssueOnGitHub(url: string): Promise<void> {
    try {
      await window.devBrowser.navigation.openExternal(url)
    } catch (cause) {
      setIssueError(cause instanceof Error ? cause.message : 'Could not open issue on GitHub.')
    }
  }

  async function loadActionsRuns(nextStatus = status, page = actionsRuns?.page ?? 1): Promise<void> {
    const remote = nextStatus?.githubRemote?.github
    if (!remote) {
      setActionsRuns(null)
      return
    }
    setActionsError(null)
    try {
      setActionsRuns(await window.devBrowser.github.listActionsRuns({ owner: remote.owner, repository: remote.repository, page, perPage: 10 }))
    } catch (cause) {
      setActionsError(cause instanceof Error ? cause.message : 'Could not list GitHub Actions runs.')
    }
  }

  async function openActionsRunOnGitHub(url: string): Promise<void> {
    try {
      await window.devBrowser.navigation.openExternal(url)
    } catch (cause) {
      setActionsError(cause instanceof Error ? cause.message : 'Could not open GitHub Actions run.')
    }
  }

  async function syncRemote(operation: 'fetch' | 'pull' | 'push'): Promise<void> {
    setDiffError(null)
    setRemoteResult(null)
    setLoading(true)
    try {
      const result = operation === 'fetch'
        ? await window.devBrowser.sourceControl.fetch()
        : operation === 'pull'
          ? await window.devBrowser.sourceControl.pull()
          : await window.devBrowser.sourceControl.push()
      setRemoteResult(result.message)
      const nextStatus = await window.devBrowser.sourceControl.getStatus()
      setStatus(nextStatus)
      await syncBranches(nextStatus)
      await refreshGitHubRepository(nextStatus)
    } catch (cause) {
      setDiffError(cause instanceof Error ? cause.message : `Could not ${operation}.`)
    } finally {
      setLoading(false)
    }
  }

  async function refresh(): Promise<void> {
    setLoading(true)
    setError(null)
    setBranchError(null)
    setStatus(null)
    setBranches([])
    void refreshGitHub()
    try {
      const nextStatus = await window.devBrowser.sourceControl.getStatus()
      setStatus(nextStatus)
      await syncBranches(nextStatus)
      await refreshGitHubRepository(nextStatus)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read repository state.')
    } finally {
      setLoading(false)
    }
  }

  async function connectRepository(): Promise<void> {
    setLoading(true)
    setError(null)
    setBranchError(null)
    try {
      const result = await window.devBrowser.sourceControl.connectRepository()
      if (result.status === 'connected') {
        const nextStatus = await window.devBrowser.sourceControl.getStatus()
        setStatus(nextStatus)
        await syncBranches(nextStatus)
        await refreshGitHubRepository(nextStatus)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect repository.')
    } finally {
      setLoading(false)
    }
  }

  async function openDiff(file: GitFileStatus, staged: boolean): Promise<void> {
    setDiffError(null)
    try {
      onOpenDiff(await window.devBrowser.sourceControl.getFileDiff({ path: file.path, status: file.status, staged }))
    } catch (cause) {
      setDiffError(cause instanceof Error ? cause.message : 'Could not open file diff.')
    }
  }

  async function updateStage(file: GitFileStatus, staged: boolean): Promise<void> {
    setDiffError(null)
    try {
      setStatus(staged
        ? await window.devBrowser.sourceControl.unstageFile({ path: file.path })
        : await window.devBrowser.sourceControl.stageFile({ path: file.path }))
    } catch (cause) {
      setDiffError(cause instanceof Error ? cause.message : 'Could not update staging area.')
    }
  }

  async function commitStaged(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setDiffError(null)
    setCommitResult(null)
    try {
      const result = await window.devBrowser.sourceControl.commitStaged({ message: commitMessage })
      setCommitMessage('')
      setCommitResult(`Committed ${result.hash.slice(0, 7)}`)
      setStatus(await window.devBrowser.sourceControl.getStatus())
    } catch (cause) {
      setDiffError(cause instanceof Error ? cause.message : 'Could not create commit.')
    }
  }

  async function createBranch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setBranchError(null)
    const name = branchName.trim()
    if (!name) return
    setLoading(true)
    try {
      const nextStatus = await window.devBrowser.sourceControl.createBranch({ name })
      setStatus(nextStatus)
      setBranchName('')
      await syncBranches(nextStatus)
    } catch (cause) {
      setBranchError(cause instanceof Error ? cause.message : 'Could not create branch.')
    } finally {
      setLoading(false)
    }
  }

  async function switchBranch(name: string): Promise<void> {
    if (!name || name === currentBranchName) return
    setBranchError(null)
    setLoading(true)
    try {
      const nextStatus = await window.devBrowser.sourceControl.switchBranch({ name })
      setStatus(nextStatus)
      await syncBranches(nextStatus)
    } catch (cause) {
      setBranchError(cause instanceof Error ? cause.message : 'Could not switch branch.')
    } finally {
      setLoading(false)
    }
  }

  function toggleSection(section: SourceSectionKey): void {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }))
  }

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    if (githubStatus?.state !== 'connecting') return
    const id = window.setInterval(() => { void refreshGitHub() }, 2000)
    return () => window.clearInterval(id)
  }, [githubStatus?.state])

  useEffect(() => {
    if (!status?.githubRemote?.github) return
    void loadPullRequests(status, pullRequestState, 1)
  }, [pullRequestState])

  useEffect(() => {
    if (!status?.githubRemote?.github) return
    void loadIssues(status, issueState, 1)
  }, [issueState])

  useEffect(() => {
    setPullRequestBase(githubRepository?.defaultBranch ?? '')
  }, [githubRepository?.defaultBranch])

  useEffect(() => {
    setPullRequestHead(currentBranchName)
    setPullRequestTitle(currentBranchName ? currentBranchName.replace(/[-_/]+/g, ' ') : '')
  }, [currentBranchName])

  return (
    <section className="source-control-section" aria-label="Source Control">
      <header>
        <GitBranch size={15} aria-hidden="true" />
        <span>Source Control</span>
      </header>
      {repository
        ? <div className={`source-control-repository${repository.available ? '' : ' is-unavailable'}`}>
          <FolderGit2 size={14} aria-hidden="true" />
          <span title={repository.rootPath}>{repository.available ? repository.name : `${repository.name} unavailable`}</span>
        </div>
        : <button type="button" className="source-control-connect" disabled={isLoading} onClick={() => { void connectRepository() }}>
          <FolderGit2 size={14} aria-hidden="true" />
          <span>{isLoading ? 'Connecting...' : 'Connect Repository'}</span>
        </button>}
      {repository && !repository.available && <button type="button" className="source-control-connect" disabled={isLoading} onClick={() => { void connectRepository() }}>
        <FolderGit2 size={14} aria-hidden="true" />
        <span>{isLoading ? 'Connecting...' : 'Reconnect Repository'}</span>
      </button>}
      {repository?.available && <div className="source-control-status">
        <span>{status?.currentBranch?.name ?? 'No branch'}</span>
        <strong>{changeCount} change{changeCount === 1 ? '' : 's'}</strong>
      </div>}
      {repository?.available && <div className={`source-control-remote${githubRemote ? ' is-github' : ''}`}>
        <Github size={14} aria-hidden="true" />
        <span title={githubRemote?.url ?? undefined}>{githubRemote?.github ? `${githubRemote.github.owner}/${githubRemote.github.repository}` : remoteCount === 0 ? 'No remotes' : 'No GitHub remote'}</span>
        <strong>{githubRemote?.name ?? `${remoteCount}`}</strong>
      </div>}
      {repository?.available && remoteCount > 0 && <div className="source-control-remote-actions">
        <button type="button" disabled={isLoading} onClick={() => { void syncRemote('fetch') }}>Fetch</button>
        <button type="button" disabled={isLoading} onClick={() => { void syncRemote('pull') }}>Pull</button>
        <button type="button" disabled={isLoading || !upstream} title={upstream ? `Push to ${upstream}` : 'Current branch has no upstream'} onClick={() => { void syncRemote('push') }}>Push</button>
      </div>}
      {repository?.available && remoteCount > 0 && <div className="source-control-push-target">
        <span>Push target</span>
        <strong title={upstream ?? undefined}>{upstream ?? 'No upstream'}</strong>
      </div>}
      {repository?.available && githubRemote && <GitHubRepositoryInfo metadata={githubRepository} error={githubRepositoryError} />}
      {repository?.available && githubRemote && <PullRequestsSection page={pullRequests} state={pullRequestState} error={pullRequestError} selectedNumber={pullRequestDetailNumber} detail={pullRequestDetail} detailError={pullRequestDetailError} detailLoading={pullRequestDetailLoading} createForm={{ title: pullRequestTitle, body: pullRequestBody, base: pullRequestBase, head: pullRequestHead, confirmed: pullRequestConfirmed, result: pullRequestCreateResult, repository: githubRemote.github ? `${githubRemote.github.owner}/${githubRemote.github.repository}` : '', disabled: pullRequestDetailLoading || !pullRequestTitle.trim() || !pullRequestBase.trim() || !pullRequestHead.trim() || !pullRequestConfirmed }} onCreateChange={{ setTitle: setPullRequestTitle, setBody: setPullRequestBody, setBase: setPullRequestBase, setHead: setPullRequestHead, setConfirmed: setPullRequestConfirmed }} onCreate={createPullRequest} onStateChange={setPullRequestState} onPageChange={(page) => { void loadPullRequests(status, pullRequestState, page) }} onSelect={(number) => { void loadPullRequestDetail(number) }} onOpenExternal={(url) => { void openPullRequestOnGitHub(url) }} />}
      {repository?.available && githubRemote && <IssuesSection page={issues} state={issueState} error={issueError} onStateChange={setIssueState} onPageChange={(page) => { void loadIssues(status, issueState, page) }} onOpenExternal={(url) => { void openIssueOnGitHub(url) }} />}
      {repository?.available && githubRemote && <ActionsRunsSection page={actionsRuns} error={actionsError} onPageChange={(page) => { void loadActionsRuns(status, page) }} onOpenExternal={(url) => { void openActionsRunOnGitHub(url) }} />}
      <GitHubConnection status={githubStatus} onConnect={connectGitHub} onCancel={cancelGitHubLogin} onDisconnect={disconnectGitHub} onOpenAuthorization={openGitHubAuthorization} onOpenProfile={openGitHubProfile} />
      {repository?.available && <section className="source-control-branches" aria-label="Branches">
        <button type="button" className="source-control-section-toggle" aria-expanded={!collapsedSections.branches} onClick={() => toggleSection('branches')}>
          {collapsedSections.branches ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
          <span>Branches</span>
          <strong>{branches.length}</strong>
        </button>
        {!collapsedSections.branches && <>
          <select aria-label="Switch branch" value={branches.some((branch) => branch.name === currentBranchName) ? currentBranchName : ''} disabled={isLoading || branches.length === 0} onChange={(event) => { void switchBranch(event.target.value) }}>
            {!branches.some((branch) => branch.name === currentBranchName) && <option value="">{currentBranchName || 'No branch'}</option>}
            {branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.current ? `${branch.name} *` : branch.name}</option>)}
          </select>
          <form onSubmit={(event) => { void createBranch(event) }}>
            <input aria-label="New branch name" placeholder="New branch" value={branchName} onChange={(event) => setBranchName(event.target.value)} />
            <button type="submit" disabled={isLoading || branchName.trim().length === 0}>Create</button>
          </form>
        </>}
      </section>}
      {repository?.available && <div className="source-control-file-groups">
        <FileGroup title="Staged Changes" files={stagedFiles} collapsed={collapsedSections.staged} staged onToggle={() => toggleSection('staged')} onSelect={openDiff} onStageChange={updateStage} />
        <FileGroup title="Changes" files={unstagedFiles} collapsed={collapsedSections.changes} onToggle={() => toggleSection('changes')} onSelect={openDiff} onStageChange={updateStage} />
        <FileGroup title="Untracked Files" files={untrackedFiles} collapsed={collapsedSections.untracked} onToggle={() => toggleSection('untracked')} onSelect={openDiff} onStageChange={updateStage} />
      </div>}
      {repository?.available && <form className="source-control-commit" onSubmit={(event) => { void commitStaged(event) }}>
        <input aria-label="Commit message" placeholder="Commit message" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} />
        <button type="submit" disabled={stagedFiles.length === 0 || commitMessage.trim().length === 0}>Commit</button>
      </form>}
      {repository?.available && <CommitHistory commits={commits} collapsed={collapsedSections.history} onToggle={() => toggleSection('history')} onOpen={onOpenCommit} />}
      {commitResult && <p className="source-control-success" role="status">{commitResult}</p>}
      {remoteResult && <p className="source-control-success" role="status">{remoteResult}</p>}
      {branchError && <p role="alert">{branchError}</p>}
      {diffError && <p role="alert">{diffError}</p>}
      {repository?.unavailableReason && <p role="status">{repository.unavailableReason}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

function GitHubRepositoryInfo({ metadata, error }: { metadata: GitHubRepositoryMetadata | null; error: string | null }) {
  if (error) return <p className="source-control-github-repository-error" role="alert">{error}</p>
  if (!metadata) return <div className="source-control-github-repository is-loading">Loading repository...</div>
  return <section className="source-control-github-repository" aria-label="GitHub repository">
    <div>
      <strong title={`${metadata.owner}/${metadata.name}`}>{metadata.owner}/{metadata.name}</strong>
      <span>{metadata.visibility}</span>
    </div>
    {metadata.description && <p title={metadata.description}>{metadata.description}</p>}
    <dl>
      <div><dt>Default</dt><dd>{metadata.defaultBranch}</dd></div>
      <div><dt>Updated</dt><dd>{formatCommitDate(metadata.updatedAt)}</dd></div>
    </dl>
  </section>
}

function PullRequestsSection({ page, state, error, selectedNumber, detail, detailError, detailLoading, createForm, onCreateChange, onCreate, onStateChange, onPageChange, onSelect, onOpenExternal }: { page: GitHubPullRequestPage | null; state: GitHubPullRequestState; error: string | null; selectedNumber: number | null; detail: GitHubPullRequestDetail | null; detailError: string | null; detailLoading: boolean; createForm: PullRequestCreateFormState; onCreateChange: PullRequestCreateFormActions; onCreate: (event: FormEvent<HTMLFormElement>) => void; onStateChange: (state: GitHubPullRequestState) => void; onPageChange: (page: number) => void; onSelect: (number: number) => void; onOpenExternal: (url: string) => void }) {
  const items = page?.items ?? []

  return <section className="source-control-pull-requests" aria-label="GitHub pull requests">
    <div className="source-control-pr-toolbar">
      <strong>Pull Requests</strong>
      <div className="source-control-pr-filters" role="group" aria-label="Pull request state">
        <button type="button" className={state === 'open' ? 'is-active' : ''} aria-pressed={state === 'open'} onClick={() => onStateChange('open')}>Open</button>
        <button type="button" className={state === 'closed' ? 'is-active' : ''} aria-pressed={state === 'closed'} onClick={() => onStateChange('closed')}>Closed</button>
      </div>
    </div>
    <form className="source-control-pr-create" onSubmit={onCreate}>
      <div className="source-control-pr-create-target">
        <span>New pull request</span>
        <strong title={createForm.repository}>{createForm.repository}</strong>
      </div>
      <input aria-label="Pull request title" placeholder="Title" value={createForm.title} onChange={(event) => onCreateChange.setTitle(event.target.value)} />
      <textarea aria-label="Pull request description" placeholder="Description" rows={3} value={createForm.body} onChange={(event) => onCreateChange.setBody(event.target.value)} />
      <div className="source-control-pr-create-branches">
        <label>
          <span>Base Branch</span>
          <input value={createForm.base} onChange={(event) => onCreateChange.setBase(event.target.value)} />
        </label>
        <label>
          <span>Head Branch</span>
          <input value={createForm.head} onChange={(event) => onCreateChange.setHead(event.target.value)} />
        </label>
      </div>
      <label className="source-control-pr-confirm">
        <input type="checkbox" checked={createForm.confirmed} onChange={(event) => onCreateChange.setConfirmed(event.target.checked)} />
        <span>Create this pull request on GitHub</span>
      </label>
      <button type="submit" disabled={createForm.disabled}>Create Pull Request</button>
      {createForm.result && <div className="source-control-pr-created">
        <span title={createForm.result.title}>{createForm.result.title}</span>
        <button type="button" onClick={() => onOpenExternal(createForm.result!.url)}>Open on GitHub</button>
      </div>}
    </form>
    {error && <p role="alert">{error}</p>}
    {!error && !page && <p>Loading pull requests...</p>}
    {!error && page && items.length === 0 && <p>No {state} pull requests.</p>}
    {items.length > 0 && <ul className="source-control-pr-list">
      {items.map((pullRequest) => <li key={pullRequest.number} className="source-control-pr-item">
        <button type="button" className={pullRequest.number === selectedNumber ? 'is-active' : ''} onClick={() => onSelect(pullRequest.number)}>
          <strong title={pullRequest.title}>#{pullRequest.number} {pullRequest.title}</strong>
          <span title={`${pullRequest.head} into ${pullRequest.base}`}>{pullRequest.head} {'->'} {pullRequest.base}</span>
          <small>{pullRequest.author} · {formatCommitDate(pullRequest.updatedAt)}</small>
        </button>
      </li>)}
    </ul>}
    {page && <div className="source-control-pr-pagination">
      <button type="button" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>Previous</button>
      <span>Page {page.page}</span>
      <button type="button" disabled={!page.hasNextPage} onClick={() => onPageChange(page.page + 1)}>Next</button>
    </div>}
    {(detailLoading || detailError || detail) && <PullRequestDetail detail={detail} error={detailError} loading={detailLoading} onOpenExternal={onOpenExternal} />}
  </section>
}

function PullRequestDetail({ detail, error, loading, onOpenExternal }: { detail: GitHubPullRequestDetail | null; error: string | null; loading: boolean; onOpenExternal: (url: string) => void }) {
  if (loading) return <section className="source-control-pr-detail is-loading" aria-label="Pull request details">Loading details...</section>
  if (error) return <p className="source-control-pr-detail-error" role="alert">{error}</p>
  if (!detail) return null
  const checkLabel = detail.checks
    ? detail.checks.state === 'none' ? 'No checks' : `${detail.checks.state} (${detail.checks.passed}/${detail.checks.total})`
    : 'Checks unavailable'

  return <section className="source-control-pr-detail" aria-label={`Pull request #${detail.number} details`}>
    <header>
      <div>
        <strong title={detail.title}>#{detail.number} {detail.title}</strong>
        <span>{detail.state}{detail.merged ? ' / merged' : ''} by {detail.author}</span>
      </div>
      <button type="button" onClick={() => onOpenExternal(detail.url)}>
        <ExternalLink size={13} aria-hidden="true" />
        <span>Open on GitHub</span>
      </button>
    </header>
    {detail.body && <p>{detail.body}</p>}
    <dl>
      <div><dt>Branches</dt><dd>{detail.head} {'->'} {detail.base}</dd></div>
      <div><dt>Checks</dt><dd>{checkLabel}</dd></div>
      <div><dt>Updated</dt><dd>{formatCommitDate(detail.updatedAt)}</dd></div>
    </dl>
    <div className="source-control-pr-detail-grid">
      <section>
        <strong>Commits</strong>
        {detail.commits.length === 0 ? <span>No commits.</span> : <ul>
          {detail.commits.map((commit) => <li key={commit.sha}>
            <code>{commit.sha.slice(0, 7)}</code>
            <span title={commit.message}>{commit.message}</span>
          </li>)}
        </ul>}
      </section>
      <section>
        <strong>Files</strong>
        {detail.files.length === 0 ? <span>No files changed.</span> : <ul>
          {detail.files.map((file) => <li key={file.filename}>
            <span title={file.filename}>{file.filename}</span>
            <small>+{file.additions} -{file.deletions}</small>
          </li>)}
        </ul>}
      </section>
    </div>
  </section>
}

function IssuesSection({ page, state, error, onStateChange, onPageChange, onOpenExternal }: { page: GitHubIssuePage | null; state: GitHubIssueState; error: string | null; onStateChange: (state: GitHubIssueState) => void; onPageChange: (page: number) => void; onOpenExternal: (url: string) => void }) {
  const items = page?.items ?? []

  return <section className="source-control-issues" aria-label="GitHub issues">
    <div className="source-control-issues-toolbar">
      <strong>Issues</strong>
      <div className="source-control-issues-filters" role="group" aria-label="Issue state">
        {(['open', 'closed', 'all'] as const).map((nextState) => <button key={nextState} type="button" className={state === nextState ? 'is-active' : ''} aria-pressed={state === nextState} onClick={() => onStateChange(nextState)}>{nextState}</button>)}
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    {!error && !page && <p>Loading issues...</p>}
    {!error && page && items.length === 0 && <p>No {state} issues.</p>}
    {items.length > 0 && <ul className="source-control-issues-list">
      {items.map((issue) => <li key={issue.number}>
        <div>
          <strong title={issue.title}>#{issue.number} {issue.title}</strong>
          <span>{issue.state} by {issue.author}{issue.assignee ? ` / assigned to ${issue.assignee}` : ''}</span>
          {issue.labels.length > 0 && <div className="source-control-issue-labels">{issue.labels.slice(0, 4).map((label) => <small key={label} title={label}>{label}</small>)}</div>}
        </div>
        <button type="button" aria-label={`Open issue #${issue.number} on GitHub`} data-tooltip="Open on GitHub" onClick={() => onOpenExternal(issue.url)}>
          <ExternalLink size={13} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
    {page && <div className="source-control-issues-pagination">
      <button type="button" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>Previous</button>
      <span>Page {page.page}</span>
      <button type="button" disabled={!page.hasNextPage} onClick={() => onPageChange(page.page + 1)}>Next</button>
    </div>}
  </section>
}

function ActionsRunsSection({ page, error, onPageChange, onOpenExternal }: { page: GitHubActionsRunPage | null; error: string | null; onPageChange: (page: number) => void; onOpenExternal: (url: string) => void }) {
  const items = page?.items ?? []

  return <section className="source-control-actions-runs" aria-label="GitHub Actions">
    <div className="source-control-actions-runs-toolbar">
      <strong>Actions</strong>
      <span>{page ? `${items.length} run${items.length === 1 ? '' : 's'}` : 'Loading'}</span>
    </div>
    {error && <p role="alert">{error}</p>}
    {!error && !page && <p>Loading workflow runs...</p>}
    {!error && page && items.length === 0 && <p>No workflow runs.</p>}
    {items.length > 0 && <ul className="source-control-actions-runs-list">
      {items.map((run) => <li key={run.id}>
        <div>
          <strong title={run.workflow}>{run.workflow}</strong>
          <span title={`${run.branch} / ${run.commit}`}>{run.branch} / {run.commit.slice(0, 7)}</span>
          <small>{run.status}{run.conclusion ? ` / ${run.conclusion}` : ''} · {formatCommitDate(run.createdAt)}</small>
        </div>
        <button type="button" aria-label={`View ${run.workflow} on GitHub`} data-tooltip="View on GitHub" onClick={() => onOpenExternal(run.url)}>
          <ExternalLink size={13} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
    {page && <div className="source-control-actions-runs-pagination">
      <button type="button" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>Previous</button>
      <span>Page {page.page}</span>
      <button type="button" disabled={!page.hasNextPage} onClick={() => onPageChange(page.page + 1)}>Next</button>
    </div>}
  </section>
}

function GitHubConnection({ status, onConnect, onCancel, onDisconnect, onOpenAuthorization, onOpenProfile }: { status: GitHubProviderStatus | null; onConnect: () => void; onCancel: () => void; onDisconnect: () => void; onOpenAuthorization: () => void; onOpenProfile: () => void }) {
  const state = status?.state ?? 'disconnected'
  const authorization = status?.authorization ?? null
  const identity = status?.displayName ?? status?.username ?? 'GitHub'

  return <section className={`source-control-github source-control-github--${state}`} aria-label="GitHub connection">
    {state === 'connected'
      ? <div className="source-control-github-profile">
        {status?.avatarUrl ? <img src={status.avatarUrl} alt="" /> : <Github size={24} aria-hidden="true" />}
        <div>
          <strong title={identity}>{identity}</strong>
          <span title={status?.username ?? undefined}>{status?.username ? `@${status.username}` : 'GitHub'}</span>
        </div>
        <button type="button" aria-label="Open GitHub profile" data-tooltip="Open GitHub profile" onClick={onOpenProfile}>
          <ExternalLink size={13} />
        </button>
      </div>
      : <div className="source-control-github-status">
        <Github size={14} aria-hidden="true" />
        <span>GitHub</span>
        <strong>{githubStatusLabel[state]}</strong>
      </div>}
    {state === 'disconnected' || state === 'error'
      ? <button type="button" className="source-control-github-action" onClick={onConnect}>
        <Github size={13} aria-hidden="true" />
        <span>Connect GitHub</span>
      </button>
      : null}
    {state === 'connected' && <button type="button" className="source-control-github-action" onClick={onDisconnect}>
      <X size={13} aria-hidden="true" />
      <span>Disconnect GitHub</span>
    </button>}
    {authorization && <div className="source-control-github-auth">
      <span>Code</span>
      <strong>{authorization.userCode}</strong>
      <button type="button" aria-label="Open GitHub authorization page" data-tooltip="Open GitHub authorization" onClick={onOpenAuthorization}>
        <ExternalLink size={13} />
      </button>
      <button type="button" aria-label="Cancel GitHub login" data-tooltip="Cancel login" onClick={onCancel}>
        <X size={13} />
      </button>
      <small title={authorization.verificationUri}>{authorization.verificationUri}</small>
    </div>}
    {status?.error && <p role="alert">{status.error}</p>}
  </section>
}

function CommitHistory({ commits, collapsed, onToggle, onOpen }: { commits: GitCommit[]; collapsed: boolean; onToggle: () => void; onOpen: (commit: GitCommit) => void }) {
  return <section className="source-control-history" aria-label="Commit history">
    <button type="button" className="source-control-section-toggle" aria-expanded={!collapsed} onClick={onToggle}>
      {collapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
      <span>History</span>
      <strong>{commits.length}</strong>
    </button>
    {!collapsed && (commits.length === 0
      ? <p>No commits yet.</p>
      : <>
        <ul>
          {commits.map((commit) => <li key={commit.hash}>
            <button type="button" onClick={() => onOpen(commit)}>
              <span>{commit.shortHash}</span>
              <strong title={commit.message}>{commit.message}</strong>
              <small>{formatCommitDate(commit.authoredAt)}</small>
            </button>
          </li>)}
        </ul>
      </>)}
  </section>
}

function FileGroup({ title, files, collapsed, staged = false, onToggle, onSelect, onStageChange }: { title: string; files: GitFileStatus[]; collapsed: boolean; staged?: boolean; onToggle: () => void; onSelect: (file: GitFileStatus, staged: boolean) => void; onStageChange: (file: GitFileStatus, staged: boolean) => void }) {
  if (files.length === 0) return null
  return <section className="source-control-file-group" aria-label={title}>
    <button type="button" className="source-control-section-toggle" aria-expanded={!collapsed} onClick={onToggle}>
      {collapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
      <span>{title}</span>
      <strong>{files.length}</strong>
    </button>
    {!collapsed && <ul>
      {files.map((file) => <li key={`${title}:${file.path}:${file.status}`}>
        <button type="button" className="source-control-file-main" onClick={() => onSelect(file, staged)}>
          <StatusIcon status={file.status} />
          <span className={`source-control-file-status source-control-file-status--${file.status}`}>{statusLabel[file.status]}</span>
          <span title={file.path}>{file.path}</span>
        </button>
        <button type="button" className="source-control-stage-action" aria-label={staged ? `Unstage ${file.path}` : `Stage ${file.path}`} data-tooltip={staged ? 'Unstage file' : 'Stage file'} onClick={() => onStageChange(file, staged)}>
          {staged ? <Minus size={13} /> : <Plus size={13} />}
        </button>
      </li>)}
    </ul>}
  </section>
}

function formatCommitDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function StatusIcon({ status }: { status: GitFileStatus['status'] }) {
  if (status === 'added' || status === 'untracked') return <FilePlus2 size={13} aria-hidden="true" />
  if (status === 'deleted') return <FileX2 size={13} aria-hidden="true" />
  if (status === 'renamed' || status === 'copied') return <RefreshCw size={13} aria-hidden="true" />
  return <Circle size={10} aria-hidden="true" />
}
