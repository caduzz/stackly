import type { SettingsRepository } from '../storage/SettingsRepository'
import type { GitHubCredentialStore } from './github-credential.store'
import type { GitHubConnectionMetadata, GitHubProviderStatus } from './github.types'

type DeviceAuthorizationResponse = {
  device_code?: string
  user_code?: string
  verification_uri?: string
  expires_in?: number
  interval?: number
  error?: string
  error_description?: string
}

type AccessTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type PendingAuthorization = {
  deviceCode: string
  intervalMs: number
  cancelled: boolean
}

const defaultStatus: GitHubProviderStatus = {
  state: 'disconnected',
  username: null,
  displayName: null,
  avatarUrl: null,
  profileUrl: null,
  authorization: null,
  error: null
}

export class GitHubAuthService {
  private status: GitHubProviderStatus = defaultStatus
  private pending: PendingAuthorization | null = null
  private accessToken: string | null = null

  constructor(
    private readonly credentials: GitHubCredentialStore,
    private readonly settings: SettingsRepository
  ) {}

  getStatus(): GitHubProviderStatus {
    return this.status
  }

  token(): string | null {
    return this.accessToken
  }

  async restoreSession(): Promise<GitHubProviderStatus> {
    const metadata = this.settings.getGitHubConnectionMetadata()
    if (!metadata) return this.status
    try {
      const token = await this.credentials.getCredential()
      if (!token) {
        this.settings.deleteGitHubConnectionMetadata()
        return this.status
      }
      this.accessToken = token
      this.status = this.connectedStatus(metadata)
      return this.status
    } catch (cause) {
      this.accessToken = null
      this.status = { ...defaultStatus, state: 'error', error: cause instanceof Error ? cause.message : 'Could not restore GitHub credentials.' }
      return this.status
    }
  }

  async startLogin(onToken: (token: string) => Promise<GitHubProviderStatus>): Promise<GitHubProviderStatus> {
    if (this.status.state === 'connected') return this.status
    if (this.pending) return this.status
    if (!this.credentials.isAvailable()) return this.setError('Secure credential storage is unavailable on this system.')

    const clientId = process.env.STACKLY_GITHUB_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID
    if (!clientId) return this.setError('Set STACKLY_GITHUB_CLIENT_ID to connect GitHub.')

    const authorization = await requestDeviceAuthorization(clientId)
    const expiresAt = new Date(Date.now() + authorization.expiresIn * 1000).toISOString()
    this.pending = { deviceCode: authorization.deviceCode, intervalMs: authorization.interval * 1000, cancelled: false }
    this.status = {
      ...defaultStatus,
      state: 'connecting',
      authorization: {
        userCode: authorization.userCode,
        verificationUri: authorization.verificationUri,
        expiresAt
      }
    }
    void this.pollForToken(clientId, this.pending, onToken)
    return this.status
  }

  cancelLogin(): GitHubProviderStatus {
    if (this.pending) this.pending.cancelled = true
    this.pending = null
    if (!this.accessToken) this.status = defaultStatus
    return this.status
  }

  async completeLogin(status: GitHubProviderStatus, token: string): Promise<GitHubProviderStatus> {
    const metadata = metadataFromStatus(status)
    await this.credentials.saveCredential(token)
    this.accessToken = token
    this.pending = null
    return this.updateProfile(metadata)
  }

  updateProfile(metadata: GitHubConnectionMetadata): GitHubProviderStatus {
    this.settings.setGitHubConnectionMetadata(metadata)
    this.status = this.connectedStatus(metadata)
    return this.status
  }

  failProfileRefresh(message: string): GitHubProviderStatus {
    this.status = { ...this.status, state: 'error', authorization: null, error: message }
    return this.status
  }

  async disconnect(): Promise<GitHubProviderStatus> {
    if (this.pending) this.pending.cancelled = true
    this.pending = null
    this.accessToken = null
    await this.credentials.deleteCredential()
    this.settings.deleteGitHubConnectionMetadata()
    this.status = defaultStatus
    return this.status
  }

  failLogin(message: string): GitHubProviderStatus {
    this.pending = null
    this.accessToken = null
    return this.setError(message)
  }

  private async pollForToken(clientId: string, pending: PendingAuthorization, onToken: (token: string) => Promise<GitHubProviderStatus>): Promise<void> {
    try {
      while (!pending.cancelled && this.pending === pending) {
        await delay(pending.intervalMs)
        if (pending.cancelled || this.pending !== pending) return
        const response = await requestAccessToken(clientId, pending.deviceCode)
        if (response.error === 'authorization_pending') continue
        if (response.error === 'slow_down') {
          pending.intervalMs += 5000
          continue
        }
        if (response.error === 'expired_token') {
          this.failLogin('GitHub authorization code expired.')
          return
        }
        if (response.error) {
          this.failLogin(response.error_description ?? response.error)
          return
        }
        if (!response.access_token) {
          this.failLogin('GitHub did not return an access token.')
          return
        }
        await onToken(response.access_token)
        return
      }
    } catch (cause) {
      this.failLogin(cause instanceof Error ? cause.message : 'Could not finish GitHub login.')
    }
  }

  private setError(message: string): GitHubProviderStatus {
    this.status = { ...defaultStatus, state: 'error', error: message }
    return this.status
  }

  private connectedStatus(metadata: GitHubConnectionMetadata): GitHubProviderStatus {
    return {
      ...defaultStatus,
      ...metadata,
      state: 'connected'
    }
  }
}

function metadataFromStatus(status: GitHubProviderStatus): GitHubConnectionMetadata {
  return {
    username: status.username,
    displayName: status.displayName,
    avatarUrl: status.avatarUrl,
    profileUrl: status.profileUrl
  }
}

async function requestDeviceAuthorization(clientId: string): Promise<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number; interval: number }> {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: 'repo read:user user:email' })
  })
  const body = await response.json() as DeviceAuthorizationResponse
  if (!response.ok || body.error) throw new Error(body.error_description ?? body.error ?? 'Could not start GitHub login.')
  if (!body.device_code || !body.user_code || !body.verification_uri || !body.expires_in) throw new Error('GitHub returned an invalid device authorization response.')
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    expiresIn: body.expires_in,
    interval: body.interval ?? 5
  }
}

async function requestAccessToken(clientId: string, deviceCode: string): Promise<AccessTokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  })
  return await response.json() as AccessTokenResponse
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
