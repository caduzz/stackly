import { Octokit } from '@octokit/rest'
import type { GitHubAuthService } from './github-auth.service'
import type { GitHubRepositoryService } from './github-repository.service'
import type { GitHubActionsRunListRequest, GitHubActionsRunPage, GitHubIssueListRequest, GitHubIssuePage, GitHubProviderStatus, GitHubPullRequestCreateRequest, GitHubPullRequestCreateResult, GitHubPullRequestDetail, GitHubPullRequestDetailRequest, GitHubPullRequestPage, GitHubPullRequestListRequest, GitHubRepositoryMetadata, GitHubRepositoryRequest } from './github.types'

export class GitHubProvider {
  readonly api = new Octokit()

  constructor(
    private readonly auth: GitHubAuthService,
    readonly repositories: GitHubRepositoryService
  ) {}

  getStatus(): GitHubProviderStatus {
    return this.auth.getStatus()
  }

  isConnected(): boolean {
    return this.auth.token() !== null
  }

  async restoreSession(): Promise<GitHubProviderStatus> {
    return this.auth.restoreSession()
  }

  async startLogin(): Promise<GitHubProviderStatus> {
    try {
      return await this.auth.startLogin(async (token) => {
        const user = await new Octokit({ auth: token }).rest.users.getAuthenticated()
        return await this.auth.completeLogin({
          state: 'connected',
          username: user.data.login,
          displayName: user.data.name,
          avatarUrl: user.data.avatar_url,
          profileUrl: user.data.html_url,
          authorization: null,
          error: null
        }, token)
      })
    } catch (cause) {
      return this.auth.failLogin(cause instanceof Error ? cause.message : 'Could not connect GitHub.')
    }
  }

  cancelLogin(): GitHubProviderStatus {
    return this.auth.cancelLogin()
  }

  async disconnect(): Promise<GitHubProviderStatus> {
    return this.auth.disconnect()
  }

  async refreshProfile(): Promise<GitHubProviderStatus> {
    const token = this.auth.token()
    if (!token) return this.auth.failProfileRefresh('GitHub is not connected.')
    try {
      const user = await new Octokit({ auth: token }).rest.users.getAuthenticated()
      return this.auth.updateProfile({
        username: user.data.login,
        displayName: user.data.name,
        avatarUrl: user.data.avatar_url,
        profileUrl: user.data.html_url
      })
    } catch (cause) {
      return this.auth.failProfileRefresh(cause instanceof Error ? cause.message : 'Could not refresh GitHub profile.')
    }
  }

  async getRepository(request: GitHubRepositoryRequest): Promise<GitHubRepositoryMetadata> {
    try {
      const result = await this.client().rest.repos.get({ owner: request.owner, repo: request.repository })
      return {
        name: result.data.name,
        owner: result.data.owner.login,
        description: result.data.description,
        visibility: result.data.visibility === 'internal' ? 'internal' : result.data.private ? 'private' : 'public',
        defaultBranch: result.data.default_branch,
        url: result.data.html_url,
        updatedAt: result.data.updated_at ?? new Date(0).toISOString()
      }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not read ${request.owner}/${request.repository}.`))
    }
  }

  async listPullRequests(request: GitHubPullRequestListRequest): Promise<GitHubPullRequestPage> {
    try {
      const result = await this.client().rest.pulls.list({
        owner: request.owner,
        repo: request.repository,
        state: request.state,
        page: request.page,
        per_page: request.perPage + 1,
        sort: 'updated',
        direction: 'desc'
      })
      const items = result.data.slice(0, request.perPage).map((pull) => ({
        number: pull.number,
        title: pull.title || `Pull request #${pull.number}`,
        author: pull.user?.login ?? 'unknown',
        head: pull.head.ref,
        base: pull.base.ref,
        state: pull.state === 'closed' ? 'closed' as const : 'open' as const,
        url: pull.html_url,
        updatedAt: pull.updated_at ?? new Date(0).toISOString()
      }))
      return { items, page: request.page, perPage: request.perPage, hasNextPage: result.data.length > request.perPage }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not list pull requests for ${request.owner}/${request.repository}.`))
    }
  }

  async getPullRequest(request: GitHubPullRequestDetailRequest): Promise<GitHubPullRequestDetail> {
    const client = this.client()
    try {
      const [pull, commits, files] = await Promise.all([
        client.rest.pulls.get({ owner: request.owner, repo: request.repository, pull_number: request.number }),
        client.rest.pulls.listCommits({ owner: request.owner, repo: request.repository, pull_number: request.number, per_page: 30 }),
        client.rest.pulls.listFiles({ owner: request.owner, repo: request.repository, pull_number: request.number, per_page: 50 })
      ])
      const checks = await this.pullRequestChecks(client, request, pull.data.head.sha)
      return {
        number: pull.data.number,
        title: pull.data.title || `Pull request #${pull.data.number}`,
        body: pull.data.body,
        author: pull.data.user?.login ?? 'unknown',
        head: pull.data.head.ref,
        base: pull.data.base.ref,
        state: pull.data.state === 'closed' ? 'closed' : 'open',
        url: pull.data.html_url,
        createdAt: pull.data.created_at ?? new Date(0).toISOString(),
        updatedAt: pull.data.updated_at ?? new Date(0).toISOString(),
        merged: Boolean(pull.data.merged),
        checks,
        commits: commits.data.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0] || commit.sha.slice(0, 7),
          author: commit.author?.login ?? commit.commit.author?.name ?? 'unknown',
          authoredAt: commit.commit.author?.date ?? new Date(0).toISOString(),
          url: commit.html_url
        })),
        files: files.data.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes
        }))
      }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not read pull request #${request.number}.`))
    }
  }

  async createPullRequest(request: GitHubPullRequestCreateRequest): Promise<GitHubPullRequestCreateResult> {
    try {
      const result = await this.client().rest.pulls.create({
        owner: request.owner,
        repo: request.repository,
        title: request.title,
        body: request.body.trim() || undefined,
        base: request.base,
        head: request.head,
        maintainer_can_modify: true
      })
      return {
        number: result.data.number,
        title: result.data.title || `Pull request #${result.data.number}`,
        url: result.data.html_url
      }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not create pull request for ${request.head}.`))
    }
  }

  async listIssues(request: GitHubIssueListRequest): Promise<GitHubIssuePage> {
    try {
      const result = await this.client().rest.issues.listForRepo({
        owner: request.owner,
        repo: request.repository,
        state: request.state,
        page: request.page,
        per_page: request.perPage + 10,
        sort: 'updated',
        direction: 'desc'
      })
      const issues = result.data.filter((issue) => !issue.pull_request).slice(0, request.perPage)
      return {
        items: issues.map((issue) => ({
          number: issue.number,
          title: issue.title || `Issue #${issue.number}`,
          state: issue.state === 'closed' ? 'closed' as const : 'open' as const,
          labels: issue.labels.map((label) => typeof label === 'string' ? label : label.name).filter((label): label is string => Boolean(label)),
          assignee: issue.assignee?.login ?? null,
          author: issue.user?.login ?? 'unknown',
          url: issue.html_url,
          updatedAt: issue.updated_at ?? new Date(0).toISOString()
        })),
        page: request.page,
        perPage: request.perPage,
        hasNextPage: result.data.length > request.perPage
      }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not list issues for ${request.owner}/${request.repository}.`))
    }
  }

  async listActionsRuns(request: GitHubActionsRunListRequest): Promise<GitHubActionsRunPage> {
    try {
      const result = await this.client().rest.actions.listWorkflowRunsForRepo({
        owner: request.owner,
        repo: request.repository,
        page: request.page,
        per_page: request.perPage + 1
      })
      const runs = result.data.workflow_runs.slice(0, request.perPage)
      return {
        items: runs.map((run) => ({
          id: run.id,
          workflow: run.name || run.path || `Workflow #${run.run_number}`,
          branch: run.head_branch || 'unknown',
          commit: run.head_sha || 'unknown',
          status: this.actionsStatus(run.status),
          conclusion: this.actionsConclusion(run.conclusion),
          url: run.html_url,
          createdAt: run.created_at ?? new Date(0).toISOString()
        })),
        page: request.page,
        perPage: request.perPage,
        hasNextPage: result.data.workflow_runs.length > request.perPage
      }
    } catch (cause) {
      throw new Error(this.githubErrorMessage(cause, `Could not list GitHub Actions runs for ${request.owner}/${request.repository}.`))
    }
  }

  private actionsStatus(status: string | null): 'queued' | 'in_progress' | 'completed' {
    if (status === 'completed' || status === 'in_progress') return status
    return 'queued'
  }

  private actionsConclusion(conclusion: string | null): 'success' | 'failure' | 'cancelled' | 'skipped' | null {
    if (conclusion === 'success' || conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'skipped') return conclusion
    return null
  }

  private async pullRequestChecks(client: Octokit, request: GitHubPullRequestDetailRequest, ref: string): Promise<GitHubPullRequestDetail['checks']> {
    try {
      const result = await client.rest.checks.listForRef({ owner: request.owner, repo: request.repository, ref, per_page: 100 })
      const runs = result.data.check_runs
      const pending = runs.filter((run) => run.status !== 'completed' || !run.conclusion).length
      const failed = runs.filter((run) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(run.conclusion ?? '')).length
      const passed = runs.filter((run) => ['success', 'skipped', 'neutral'].includes(run.conclusion ?? '')).length
      return {
        state: runs.length === 0 ? 'none' : failed > 0 ? 'failing' : pending > 0 ? 'pending' : 'passing',
        total: runs.length,
        passed,
        failed,
        pending
      }
    } catch {
      return null
    }
  }

  private client(): Octokit {
    return this.auth.token() ? new Octokit({ auth: this.auth.token() }) : this.api
  }

  private githubErrorMessage(cause: unknown, fallback: string): string {
    if (typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 403 && 'response' in cause) {
      const headers = (cause as { response?: { headers?: Record<string, string | number | undefined> } }).response?.headers
      if (headers?.['x-ratelimit-remaining'] === '0' || headers?.['x-ratelimit-remaining'] === 0) return 'GitHub rate limit exceeded. Try again later.'
    }
    if (cause instanceof Error) {
      if (/no commits between|no commits/i.test(cause.message)) return 'There are no new commits between the selected branches.'
      if (/pull request already exists|already exists/i.test(cause.message)) return 'A pull request already exists for this branch.'
      if (/validation failed/i.test(cause.message)) return 'GitHub rejected the pull request. Check the base and head branches.'
      return cause.message
    }
    return fallback
  }
}
