import { app, safeStorage } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type StoredCredential = {
  version: 1
  encryptedToken: string
  updatedAt: string
}

export class GitHubCredentialStore {
  private readonly filePath = join(app.getPath('userData'), 'storage', 'github-credential.json')

  async saveCredential(token: string): Promise<void> {
    this.assertAvailable()
    const encrypted = safeStorage.encryptString(token)
    const payload: StoredCredential = {
      version: 1,
      encryptedToken: encrypted.toString('base64'),
      updatedAt: new Date().toISOString()
    }
    await mkdir(join(app.getPath('userData'), 'storage'), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 })
  }

  async getCredential(): Promise<string | null> {
    this.assertAvailable()
    try {
      const payload = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoredCredential>
      if (payload.version !== 1 || typeof payload.encryptedToken !== 'string') return null
      return safeStorage.decryptString(Buffer.from(payload.encryptedToken, 'base64'))
    } catch (cause) {
      if (isMissingFile(cause)) return null
      throw cause
    }
  }

  async deleteCredential(): Promise<void> {
    try {
      await rm(this.filePath, { force: true })
    } catch {
      /* Removing a missing credential is already the desired state. */
    }
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  private assertAvailable(): void {
    if (!this.isAvailable()) throw new Error('Secure credential storage is unavailable on this system.')
  }
}

function isMissingFile(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT'
}
