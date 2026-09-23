import { gitContextSchema, type GitContext, type GitContextFile, type GitStatusSummary } from '../../shared/contracts/git'
import type { GitService } from './git.service'

type WorkspaceIdentity = { id: string; name: string; repositoryPath: string | null }
type GitStatusProvider = Pick<GitService, 'getStatus'>

export class GitContextService {
  constructor(private readonly git: GitStatusProvider) {}

  async getContext(workspace: WorkspaceIdentity): Promise<GitContext> {
    const status = await this.git.getStatus(workspace)
    const repository = status.repository?.available ? status.repository : null
    const changedFiles = status.changedFiles

    return gitContextSchema.parse({
      workspaceId: workspace.id,
      repositoryName: repository?.name ?? null,
      repositoryPath: repository?.rootPath ?? null,
      currentBranch: status.currentBranch?.name ?? null,
      isDirty: changedFiles.length > 0,
      modifiedFiles: changedFiles.filter((file) => file.unstaged).map((file) => this.toContextFile(file)),
      stagedFiles: changedFiles.filter((file) => file.staged).map((file) => this.toContextFile(file)),
      recentCommits: status.recentCommits.slice(0, 20).map((commit) => ({
        hash: commit.hash,
        shortHash: commit.shortHash,
        message: commit.message,
        authorName: commit.authorName,
        authoredAt: commit.authoredAt
      })),
      remoteRepository: status.githubRemote?.github ?? null
    })
  }

  private toContextFile(file: GitStatusSummary['changedFiles'][number]): GitContextFile {
    return { path: file.path, status: file.status }
  }
}
