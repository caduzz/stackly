import { githubContextSchema, type GitHubContext } from '../../shared/contracts/github'
import type { GitHubProvider } from './github.provider'

type GitHubRemoteIdentity = { owner: string; repository: string } | null
type GitHubContextRequest = { remote: GitHubRemoteIdentity; currentBranch: string | null }

export class GitHubContextService {
  constructor(private readonly github: GitHubProvider) {}

  async getContext(request: GitHubContextRequest): Promise<GitHubContext> {
    if (!request.remote) return this.unavailable('No GitHub remote is configured.', request.currentBranch)
    if (!this.github.isConnected()) return this.unavailable('GitHub is not connected.', request.currentBranch)

    const repositoryRequest = { owner: request.remote.owner, repository: request.remote.repository }
    try {
      const [repository, pullRequests, issues, workflowRuns] = await Promise.all([
        this.github.getRepository(repositoryRequest),
        this.github.listPullRequests({ ...repositoryRequest, state: 'open', page: 1, perPage: 5 }),
        this.github.listIssues({ ...repositoryRequest, state: 'open', page: 1, perPage: 5 }),
        this.github.listActionsRuns({ ...repositoryRequest, page: 1, perPage: 5 })
      ])

      return githubContextSchema.parse({
        available: true,
        reason: null,
        repository,
        currentBranch: request.currentBranch,
        openPullRequests: pullRequests.items,
        recentIssues: issues.items,
        latestWorkflowRuns: workflowRuns.items
      })
    } catch (cause) {
      return this.unavailable(cause instanceof Error ? cause.message : 'Could not read GitHub context.', request.currentBranch)
    }
  }

  private unavailable(reason: string, currentBranch: string | null): GitHubContext {
    return githubContextSchema.parse({
      available: false,
      reason,
      repository: null,
      currentBranch,
      openPullRequests: [],
      recentIssues: [],
      latestWorkflowRuns: []
    })
  }
}
