import { dialog, type BrowserWindow } from 'electron'
import { lstat, readFile } from 'node:fs/promises'
import { extname, isAbsolute, resolve, sep } from 'node:path'
import { simpleGit, type StatusResult } from 'simple-git'
import type { GitBranch, GitBranchOperation, GitCommit, GitCommitRequest, GitCommitResult, GitConnectRepositoryResult, GitFileDiff, GitFileDiffRequest, GitFileOperation, GitFileStatus, GitFileStatusKind, GitHubRemote, GitRemote, GitRemoteOperationResult, GitRepository, GitRepositoryStatusCounts, GitStatusSummary } from './git.types'
import { RepositoryService } from './repository.service'

type WorkspaceIdentity = { id: string; name: string; repositoryPath: string | null }
const maxDiffFileBytes = 512 * 1024

export class GitService {
  constructor(private readonly repositories = new RepositoryService()) {}

  async connectRepository(window: BrowserWindow, workspace: WorkspaceIdentity): Promise<GitConnectRepositoryResult> {
    const result = await dialog.showOpenDialog(window, {
      title: 'Connect Repository',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' }
    const repository = await this.repositories.connectRepository(workspace.id, result.filePaths[0])
    return { status: 'connected', repository }
  }

  async getRepository(workspace: WorkspaceIdentity) {
    return this.repositories.getRepository(workspace.id, workspace.repositoryPath)
  }

  async getBranches(workspace: WorkspaceIdentity): Promise<GitBranch[]> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) return []
    const summary = await simpleGit({ baseDir: repository.rootPath }).branchLocal()
    return summary.all.map((name) => ({
      name,
      current: name === summary.current,
      remote: false,
      upstream: null
    }))
  }

  async getCurrentBranch(workspace: WorkspaceIdentity): Promise<GitBranch | null> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) return null
    return this.toCurrentBranch(await this.gitStatus(repository))
  }

  async getRepositoryStatus(workspace: WorkspaceIdentity): Promise<GitRepositoryStatusCounts> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) return this.emptyCounts()
    return this.toCounts(await this.gitStatus(repository))
  }

  async getStatus(workspace: WorkspaceIdentity): Promise<GitStatusSummary> {
    const repository = await this.getRepository(workspace)
    if (!repository?.available) return this.emptyStatus(repository)

    const status = await this.gitStatus(repository)
    const remotes = await this.getRemotes(repository)

    return {
      repository,
      currentBranch: this.toCurrentBranch(status),
      remotes,
      githubRemote: remotes.find((remote) => remote.github !== null) ?? null,
      counts: this.toCounts(status),
      changedFiles: this.toChangedFiles(status),
      recentCommits: await this.getRecentCommits(workspace)
    }
  }

  async getRecentCommits(workspace: WorkspaceIdentity, limit = 50): Promise<GitCommit[]> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) return []
    const maxCount = Math.min(Math.max(Math.trunc(limit), 1), 100)
    try {
      const result = await simpleGit({ baseDir: repository.rootPath }).log({ maxCount, strictDate: true })
      return result.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.slice(0, 7),
        message: commit.message || '(no message)',
        authorName: commit.author_name || 'Unknown',
        authorEmail: commit.author_email || null,
        authoredAt: this.toIsoDate(commit.date)
      }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (/does not have any commits|ambiguous argument|unknown revision/i.test(message)) return []
      throw cause
    }
  }

  async getFileDiff(workspace: WorkspaceIdentity, request: GitFileDiffRequest): Promise<GitFileDiff> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) throw new Error('Repository is unavailable')
    const absolutePath = this.resolveRepositoryFile(repository, request.path)
    const language = this.languageForPath(request.path)
    const git = simpleGit({ baseDir: repository.rootPath })

    try {
      if (request.status === 'untracked') {
        return this.textDiff(request.path, '', await this.readWorkingTreeFile(absolutePath), language)
      }
      if (request.status === 'added' && request.staged) {
        return this.textDiff(request.path, '', await this.readGitBlob(git, `:${request.path}`), language)
      }
      if (request.status === 'deleted') {
        const original = await this.readGitBlob(git, `HEAD:${request.path}`)
        return this.textDiff(request.path, original, '', language)
      }

      const original = request.staged
        ? await this.readGitBlobOrEmpty(git, `HEAD:${request.path}`)
        : await this.readGitBlob(git, `:${request.path}`).catch(() => this.readGitBlobOrEmpty(git, `HEAD:${request.path}`))
      const modified = request.staged ? await this.readGitBlob(git, `:${request.path}`) : await this.readWorkingTreeFile(absolutePath)
      return this.textDiff(request.path, original, modified, language)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not preview this diff'
      return {
        path: request.path,
        original: '',
        modified: '',
        language,
        binary: message.includes('Binary'),
        tooLarge: message.includes('too large'),
        message
      }
    }
  }

  async stageFile(workspace: WorkspaceIdentity, request: GitFileOperation): Promise<GitStatusSummary> {
    const repository = await this.getWritableRepository(workspace)
    this.resolveRepositoryFile(repository, request.path)
    await simpleGit({ baseDir: repository.rootPath }).add([request.path])
    return this.getStatus(workspace)
  }

  async unstageFile(workspace: WorkspaceIdentity, request: GitFileOperation): Promise<GitStatusSummary> {
    const repository = await this.getWritableRepository(workspace)
    this.resolveRepositoryFile(repository, request.path)
    await simpleGit({ baseDir: repository.rootPath }).reset(['--', request.path])
    return this.getStatus(workspace)
  }

  async commitStaged(workspace: WorkspaceIdentity, request: GitCommitRequest): Promise<GitCommitResult> {
    const repository = await this.getWritableRepository(workspace)
    const git = simpleGit({ baseDir: repository.rootPath })
    const status = await git.status()
    if (!this.hasStagedChanges(status)) throw new Error('There are no staged changes to commit.')
    try {
      const result = await git.commit(request.message.trim())
      if (!result.commit) throw new Error('Git did not return a commit hash.')
      return { hash: result.commit, summary: this.toCounts(await git.status()) }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (/user\.email|user\.name|Author identity unknown/i.test(message)) {
        throw new Error('Git author identity is not configured. Set user.name and user.email before committing.')
      }
      throw cause
    }
  }

  async createBranch(workspace: WorkspaceIdentity, request: GitBranchOperation): Promise<GitStatusSummary> {
    const repository = await this.getWritableRepository(workspace)
    await simpleGit({ baseDir: repository.rootPath }).checkoutLocalBranch(request.name)
    return this.getStatus(workspace)
  }

  async switchBranch(workspace: WorkspaceIdentity, request: GitBranchOperation): Promise<GitStatusSummary> {
    const repository = await this.getWritableRepository(workspace)
    try {
      await simpleGit({ baseDir: repository.rootPath }).checkout(request.name)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (/would be overwritten|local changes|Please commit|conflict/i.test(message)) {
        throw new Error('Branch switch was blocked by local changes. Commit, stash, or unstage them before switching.')
      }
      throw cause
    }
    return this.getStatus(workspace)
  }

  async fetch(workspace: WorkspaceIdentity): Promise<GitRemoteOperationResult> {
    const repository = await this.getWritableRepository(workspace)
    try {
      await simpleGit({ baseDir: repository.rootPath }).fetch()
      return { status: 'ok', message: 'Fetch completed.', summary: this.toCounts(await this.gitStatus(repository)) }
    } catch (cause) {
      throw new Error(this.remoteErrorMessage(cause, 'Fetch failed.'))
    }
  }

  async pull(workspace: WorkspaceIdentity): Promise<GitRemoteOperationResult> {
    const repository = await this.getWritableRepository(workspace)
    const status = await this.gitStatus(repository)
    if (!status.tracking) throw new Error('Current branch has no upstream configured.')
    if (this.hasLocalChanges(status)) throw new Error('Pull blocked by local changes. Commit, stash, or discard them before pulling.')
    try {
      const result = await simpleGit({ baseDir: repository.rootPath }).pull()
      return {
        status: result.summary.changes === 0 ? 'up-to-date' : 'ok',
        message: result.summary.changes === 0 ? 'Already up to date.' : 'Pull completed.',
        summary: this.toCounts(await this.gitStatus(repository))
      }
    } catch (cause) {
      throw new Error(this.remoteErrorMessage(cause, 'Pull failed.'))
    }
  }

  async push(workspace: WorkspaceIdentity): Promise<GitRemoteOperationResult> {
    const repository = await this.getWritableRepository(workspace)
    const status = await this.gitStatus(repository)
    if (!status.tracking) throw new Error('Current branch has no upstream configured.')
    try {
      await simpleGit({ baseDir: repository.rootPath }).push()
      return {
        status: 'ok',
        message: `Pushed ${status.current || 'current branch'} to ${status.tracking}.`,
        summary: this.toCounts(await this.gitStatus(repository))
      }
    } catch (cause) {
      throw new Error(this.remoteErrorMessage(cause, 'Push failed.'))
    }
  }

  private async getAvailableRepository(workspace: WorkspaceIdentity): Promise<GitRepository | null> {
    const repository = await this.getRepository(workspace)
    return repository?.available ? repository : null
  }

  private async getWritableRepository(workspace: WorkspaceIdentity): Promise<GitRepository> {
    const repository = await this.getAvailableRepository(workspace)
    if (!repository) throw new Error('Repository is unavailable')
    return repository
  }

  private async gitStatus(repository: GitRepository): Promise<StatusResult> {
    return simpleGit({ baseDir: repository.rootPath }).status()
  }

  private async getRemotes(repository: GitRepository): Promise<GitRemote[]> {
    const remotes = await simpleGit({ baseDir: repository.rootPath }).getRemotes(true)
    return remotes
      .map((remote) => {
        const url = remote.refs.fetch || remote.refs.push
        if (!url) return null
        return {
          name: remote.name,
          url,
          github: this.parseGitHubRemote(url)
        }
      })
      .filter((remote): remote is GitRemote => remote !== null)
  }

  private parseGitHubRemote(rawUrl: string): GitHubRemote | null {
    const value = rawUrl.trim()
    const sshMatch = /^git@github\.com:([^/]+)\/(.+)$/i.exec(value)
    if (sshMatch) return this.toGitHubRemote(sshMatch[1], sshMatch[2])

    try {
      const url = new URL(value)
      if (!['http:', 'https:', 'ssh:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'github.com') return null
      const parts = url.pathname.replace(/^\/+/, '').split('/')
      if (parts.length < 2) return null
      return this.toGitHubRemote(parts[0], parts[1])
    } catch {
      return null
    }
  }

  private toGitHubRemote(owner: string, repository: string): GitHubRemote | null {
    const cleanOwner = owner.trim()
    const cleanRepository = repository.trim().replace(/\.git$/i, '')
    if (!cleanOwner || !cleanRepository || cleanRepository.includes('/')) return null
    return {
      owner: cleanOwner,
      repository: cleanRepository,
      webUrl: `https://github.com/${cleanOwner}/${cleanRepository}`
    }
  }

  private toCurrentBranch(status: StatusResult): GitBranch {
    const name = status.detached
      ? (status.current ? `detached:${status.current}` : 'detached HEAD')
      : (status.current || 'No commits yet')
    return { name, current: true, remote: false, upstream: status.tracking || null }
  }

  private toCounts(status: StatusResult): GitRepositoryStatusCounts {
    return {
      modified: status.modified.length,
      added: status.created.length,
      deleted: status.deleted.length,
      untracked: status.not_added.length
    }
  }

  private emptyCounts(): GitRepositoryStatusCounts {
    return { modified: 0, added: 0, deleted: 0, untracked: 0 }
  }

  private toChangedFiles(status: StatusResult): GitFileStatus[] {
    return status.files.map((file) => {
      const indexStatus = this.toStatusKind(file.index)
      const workingTreeStatus = this.toStatusKind(file.working_dir)
      const statusKind = workingTreeStatus ?? indexStatus ?? 'modified'
      return {
        path: file.path,
        originalPath: null,
        status: statusKind,
        staged: indexStatus !== null,
        unstaged: workingTreeStatus !== null,
        untracked: file.index === '?' || file.working_dir === '?'
      }
    })
  }

  private hasStagedChanges(status: StatusResult): boolean {
    return status.files.some((file) => this.toStatusKind(file.index) !== null)
  }

  private hasLocalChanges(status: StatusResult): boolean {
    return status.files.length > 0
  }

  private remoteErrorMessage(cause: unknown, fallback: string): string {
    const message = cause instanceof Error ? cause.message : String(cause)
    if (/Authentication failed|Permission denied|could not read Username|Repository not found|403|401/i.test(message)) return 'Remote authentication failed or repository is inaccessible.'
    if (/CONFLICT|Automatic merge failed|Merge conflict/i.test(message)) return 'Pull stopped because of merge conflicts. Resolve the conflicts in Git before continuing.'
    if (/no tracking information|no upstream|set-upstream/i.test(message)) return 'Current branch has no upstream configured.'
    if (/non-fast-forward|fetch first|rejected|failed to push some refs/i.test(message)) return 'Push was rejected by the remote. Fetch or pull before pushing again.'
    if (/divergent|Need to specify how to reconcile/i.test(message)) return 'Pull requires a reconciliation strategy for divergent branches.'
    return message || fallback
  }

  private toStatusKind(status: string): GitFileStatusKind | null {
    if (!status.trim()) return null
    if (status === '?') return 'untracked'
    if (status === 'A') return 'added'
    if (status === 'D') return 'deleted'
    if (status === 'R') return 'renamed'
    if (status === 'C') return 'copied'
    if (status === 'U') return 'conflicted'
    return 'modified'
  }

  private resolveRepositoryFile(repository: GitRepository, relativePath: string): string {
    if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) throw new Error('Invalid repository file path')
    const root = resolve(repository.rootPath)
    const absolutePath = resolve(root, relativePath)
    if (absolutePath !== root && !absolutePath.startsWith(root + sep)) throw new Error('File is outside the repository')
    return absolutePath
  }

  private async readWorkingTreeFile(absolutePath: string): Promise<string> {
    const stats = await lstat(absolutePath)
    if (stats.isSymbolicLink()) throw new Error('Cannot diff symbolic links in this view')
    if (stats.size > maxDiffFileBytes) throw new Error('File is too large to preview')
    const buffer = await readFile(absolutePath)
    if (this.isBinary(buffer)) throw new Error('Binary files cannot be previewed')
    return buffer.toString('utf8')
  }

  private async readGitBlob(git: ReturnType<typeof simpleGit>, ref: string): Promise<string> {
    const content = await git.raw(['show', ref])
    const buffer = Buffer.from(content, 'utf8')
    if (buffer.byteLength > maxDiffFileBytes) throw new Error('File is too large to preview')
    if (this.isBinary(buffer)) throw new Error('Binary files cannot be previewed')
    return content
  }

  private async readGitBlobOrEmpty(git: ReturnType<typeof simpleGit>, ref: string): Promise<string> {
    return this.readGitBlob(git, ref).catch(() => '')
  }

  private textDiff(path: string, original: string, modified: string, language: string): GitFileDiff {
    return { path, original, modified, language, binary: false, tooLarge: false, message: null }
  }

  private isBinary(buffer: Buffer): boolean {
    return buffer.includes(0)
  }

  private languageForPath(path: string): string {
    const ext = extname(path).toLowerCase()
    if (['.ts', '.tsx'].includes(ext)) return 'typescript'
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript'
    if (ext === '.json') return 'json'
    if (ext === '.css') return 'css'
    if (ext === '.html') return 'html'
    if (ext === '.md') return 'markdown'
    return 'plaintext'
  }

  private toIsoDate(value: string): string {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
  }

  private emptyStatus(repository: Awaited<ReturnType<GitService['getRepository']>>): GitStatusSummary {
    return {
      repository,
      currentBranch: null,
      remotes: [],
      githubRemote: null,
      counts: this.emptyCounts(),
      changedFiles: [],
      recentCommits: []
    }
  }
}
