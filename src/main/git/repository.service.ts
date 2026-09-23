import { execFile } from 'node:child_process'
import { basename, normalize } from 'node:path'
import { promisify } from 'node:util'
import type { GitRepository } from './git.types'

const execFileAsync = promisify(execFile)

export class RepositoryService {
  async connectRepository(workspaceId: string, directoryPath: string): Promise<GitRepository> {
    const rootPath = await this.resolveRepositoryRoot(directoryPath)
    return this.createRepository(workspaceId, rootPath, true, null)
  }

  async getRepository(workspaceId: string, repositoryPath: string | null): Promise<GitRepository | null> {
    if (!repositoryPath) return null
    try {
      const rootPath = await this.resolveRepositoryRoot(repositoryPath)
      return this.createRepository(workspaceId, rootPath, true, null)
    } catch {
      return this.createRepository(workspaceId, normalize(repositoryPath), false, 'Repository path is unavailable or is no longer a Git repository.')
    }
  }

  private createRepository(workspaceId: string, rootPath: string, available: boolean, unavailableReason: string | null): GitRepository {
    return {
      id: `${workspaceId}:${rootPath}`,
      name: basename(rootPath),
      rootPath,
      workspaceId,
      remoteUrl: null,
      available,
      unavailableReason
    }
  }

  private async resolveRepositoryRoot(directoryPath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['-C', directoryPath, 'rev-parse', '--show-toplevel'], { windowsHide: true })
      const rootPath = stdout.trim()
      if (!rootPath) throw new Error('Git did not return a repository root')
      return normalize(rootPath)
    } catch {
      throw new Error('Selected directory is not inside a Git repository.')
    }
  }
}
