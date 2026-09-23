import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { sourceCodeFileContentSchema, sourceCodeFileSchema, type SourceCodeFile, type SourceCodeFileContent } from '../../shared/contracts/git'
import { RepositoryService } from './repository.service'

type WorkspaceIdentity = { id: string; name: string; repositoryPath: string | null }

const maxFileBytes = 256 * 1024
const maxListedFiles = 2000
const blockedDirectories = new Set(['.git', 'node_modules', 'secrets', '.secrets', '.ssh', '.aws', '.azure', '.gcp', '.gnupg'])
const blockedFileNames = [/^\.env(?:\.|$)/i, /^id_(?:rsa|dsa|ecdsa|ed25519)$/i, /credentials/i, /private[-_.]?key/i, /\.(?:pem|key|p12|pfx)$/i]

export class SourceCodeReaderService {
  constructor(private readonly repositories = new RepositoryService()) {}

  async listProjectFiles(workspace: WorkspaceIdentity): Promise<SourceCodeFile[]> {
    const root = await this.repositoryRoot(workspace)
    const files: SourceCodeFile[] = []
    await this.walk(root, root, files)
    return files
  }

  async readProjectFile(workspace: WorkspaceIdentity, path: string): Promise<SourceCodeFileContent> {
    const root = await this.repositoryRoot(workspace)
    const absolutePath = await this.resolveAllowedPath(root, path)
    const info = await stat(absolutePath)
    if (!info.isFile()) throw new Error('Path is not a file.')
    if (info.size > maxFileBytes) throw new Error('File is too large to read.')
    const buffer = await readFile(absolutePath)
    if (buffer.includes(0)) throw new Error('Binary files cannot be read.')
    return sourceCodeFileContentSchema.parse({ path: this.toProjectPath(root, absolutePath), size: info.size, content: buffer.toString('utf8') })
  }

  private async walk(root: string, directory: string, files: SourceCodeFile[]): Promise<void> {
    if (files.length >= maxListedFiles) return
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (files.length >= maxListedFiles) return
      const candidate = resolve(directory, entry.name)
      const projectPath = this.toProjectPath(root, candidate)
      if (this.isBlocked(projectPath)) continue
      const entryStats = await lstat(candidate)
      const canonical = entryStats.isSymbolicLink() ? await realpath(candidate).catch(() => null) : candidate
      if (!canonical || !this.isInside(root, canonical)) continue
      const info = await stat(canonical)
      if (info.isDirectory()) await this.walk(root, canonical, files)
      else if (info.isFile() && info.size <= maxFileBytes && !this.isBlocked(this.toProjectPath(root, canonical))) {
        files.push(sourceCodeFileSchema.parse({ path: projectPath, size: info.size }))
      }
    }
  }

  private async repositoryRoot(workspace: WorkspaceIdentity): Promise<string> {
    const repository = await this.repositories.getRepository(workspace.id, workspace.repositoryPath)
    if (!repository?.available) throw new Error('Repository is unavailable.')
    return realpath(repository.rootPath)
  }

  private async resolveAllowedPath(root: string, path: string): Promise<string> {
    if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('Invalid project file path.')
    if (this.isBlocked(path)) throw new Error('This file is protected and cannot be read.')
    const candidate = resolve(root, path)
    if (!this.isInside(root, candidate)) throw new Error('File is outside the repository.')
    const entryStats = await lstat(candidate)
    const canonical = entryStats.isSymbolicLink() ? await realpath(candidate) : await realpath(candidate)
    if (!this.isInside(root, canonical)) throw new Error('Symlink target is outside the repository.')
    if (this.isBlocked(this.toProjectPath(root, canonical))) throw new Error('This file is protected and cannot be read.')
    return canonical
  }

  private isInside(root: string, candidate: string): boolean {
    const next = resolve(candidate)
    const base = resolve(root)
    const relation = relative(base, next)
    return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
  }

  private toProjectPath(root: string, absolutePath: string): string {
    return relative(root, absolutePath).split(sep).join('/')
  }

  private isBlocked(path: string): boolean {
    const parts = path.split(/[\\/]/).filter(Boolean)
    if (parts.some((part) => blockedDirectories.has(part.toLowerCase()))) return true
    const name = parts.at(-1) ?? path
    return blockedFileNames.some((pattern) => pattern.test(name))
  }
}
