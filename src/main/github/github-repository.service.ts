import type { GitHubAuthService } from './github-auth.service'

export class GitHubRepositoryService {
  constructor(private readonly auth: GitHubAuthService) {}

  isAvailable(): boolean {
    return this.auth.getStatus().state === 'connected'
  }
}
