import { z } from 'zod'

export const gitRepositoryIdSchema = z.string().trim().min(1).max(200)
export const gitPathSchema = z.string().trim().min(1).max(4096)
export const gitHashSchema = z.string().trim().min(4).max(64)

export const gitRepositorySchema = z.strictObject({
  id: gitRepositoryIdSchema,
  name: z.string().trim().min(1).max(200),
  rootPath: gitPathSchema,
  workspaceId: z.string().trim().min(1).max(100),
  remoteUrl: z.string().trim().max(2048).nullable(),
  available: z.boolean(),
  unavailableReason: z.string().trim().min(1).max(500).nullable()
})
export type GitRepository = z.infer<typeof gitRepositorySchema>

export const gitBranchSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  current: z.boolean(),
  remote: z.boolean(),
  upstream: z.string().trim().min(1).max(255).nullable()
})
export type GitBranch = z.infer<typeof gitBranchSchema>

export const gitFileStatusKindSchema = z.enum([
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'untracked',
  'conflicted'
])
export type GitFileStatusKind = z.infer<typeof gitFileStatusKindSchema>

export const gitFileStatusSchema = z.strictObject({
  path: gitPathSchema,
  originalPath: gitPathSchema.nullable(),
  status: gitFileStatusKindSchema,
  staged: z.boolean(),
  unstaged: z.boolean(),
  untracked: z.boolean()
})
export type GitFileStatus = z.infer<typeof gitFileStatusSchema>

export const gitFileDiffRequestSchema = z.strictObject({
  path: gitPathSchema,
  status: gitFileStatusKindSchema,
  staged: z.boolean()
})
export type GitFileDiffRequest = z.infer<typeof gitFileDiffRequestSchema>

export const gitFileOperationSchema = z.strictObject({
  path: gitPathSchema
})
export type GitFileOperation = z.infer<typeof gitFileOperationSchema>

export const gitCommitRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(1000)
})
export type GitCommitRequest = z.infer<typeof gitCommitRequestSchema>

export const gitBranchNameSchema = z.string().trim().min(1).max(255).regex(/^[^\s~^:?*[\\]+(?:\/[^\s~^:?*[\\]+)*$/, 'Invalid branch name')
export const gitBranchOperationSchema = z.strictObject({
  name: gitBranchNameSchema
})
export type GitBranchOperation = z.infer<typeof gitBranchOperationSchema>

export const gitFileDiffSchema = z.strictObject({
  path: gitPathSchema,
  original: z.string(),
  modified: z.string(),
  language: z.string(),
  binary: z.boolean(),
  tooLarge: z.boolean(),
  message: z.string().nullable()
})
export type GitFileDiff = z.infer<typeof gitFileDiffSchema>

export const gitCommitSchema = z.strictObject({
  hash: gitHashSchema,
  shortHash: z.string().trim().min(4).max(12),
  message: z.string().trim().min(1).max(1000),
  authorName: z.string().trim().min(1).max(200),
  authorEmail: z.string().trim().max(320).nullable(),
  authoredAt: z.iso.datetime()
})
export type GitCommit = z.infer<typeof gitCommitSchema>

export const gitHubRemoteSchema = z.strictObject({
  owner: z.string().trim().min(1).max(100),
  repository: z.string().trim().min(1).max(200),
  webUrl: z.url()
})
export type GitHubRemote = z.infer<typeof gitHubRemoteSchema>

export const gitRemoteSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(2048),
  github: gitHubRemoteSchema.nullable()
})
export type GitRemote = z.infer<typeof gitRemoteSchema>

export const gitRepositoryStatusCountsSchema = z.strictObject({
  modified: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  untracked: z.number().int().nonnegative()
})
export type GitRepositoryStatusCounts = z.infer<typeof gitRepositoryStatusCountsSchema>

export const gitCommitResultSchema = z.strictObject({
  hash: gitHashSchema,
  summary: gitRepositoryStatusCountsSchema
})
export type GitCommitResult = z.infer<typeof gitCommitResultSchema>

export const gitRemoteOperationResultSchema = z.strictObject({
  status: z.enum(['ok', 'up-to-date']),
  message: z.string().trim().min(1).max(500),
  summary: gitRepositoryStatusCountsSchema
})
export type GitRemoteOperationResult = z.infer<typeof gitRemoteOperationResultSchema>

export const gitStatusSummarySchema = z.strictObject({
  repository: gitRepositorySchema.nullable(),
  currentBranch: gitBranchSchema.nullable(),
  remotes: z.array(gitRemoteSchema),
  githubRemote: gitRemoteSchema.nullable(),
  counts: gitRepositoryStatusCountsSchema,
  changedFiles: z.array(gitFileStatusSchema),
  recentCommits: z.array(gitCommitSchema)
})
export type GitStatusSummary = z.infer<typeof gitStatusSummarySchema>

export const gitContextFileSchema = z.strictObject({
  path: gitPathSchema,
  status: gitFileStatusKindSchema
})
export type GitContextFile = z.infer<typeof gitContextFileSchema>

export const gitContextCommitSchema = gitCommitSchema.pick({
  hash: true,
  shortHash: true,
  message: true,
  authorName: true,
  authoredAt: true
})
export type GitContextCommit = z.infer<typeof gitContextCommitSchema>

export const gitContextSchema = z.strictObject({
  workspaceId: z.string().trim().min(1).max(100),
  repositoryName: z.string().trim().min(1).max(200).nullable(),
  repositoryPath: gitPathSchema.nullable(),
  currentBranch: z.string().trim().min(1).max(255).nullable(),
  isDirty: z.boolean(),
  modifiedFiles: z.array(gitContextFileSchema),
  stagedFiles: z.array(gitContextFileSchema),
  recentCommits: z.array(gitContextCommitSchema),
  remoteRepository: gitHubRemoteSchema.nullable()
})
export type GitContext = z.infer<typeof gitContextSchema>

export const sourceCodeFileSchema = z.strictObject({
  path: gitPathSchema,
  size: z.number().int().nonnegative()
})
export type SourceCodeFile = z.infer<typeof sourceCodeFileSchema>

export const sourceCodeFileContentSchema = sourceCodeFileSchema.extend({
  content: z.string()
})
export type SourceCodeFileContent = z.infer<typeof sourceCodeFileContentSchema>

export const gitConnectRepositoryResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('connected'), repository: gitRepositorySchema }),
  z.strictObject({ status: z.literal('cancelled') })
])
export type GitConnectRepositoryResult = z.infer<typeof gitConnectRepositoryResultSchema>

export const gitChannels = {
  connectRepository: 'git:repository:connect',
  getRepository: 'git:repository:get',
  getBranches: 'git:branches:list',
  getCurrentBranch: 'git:branch:current',
  getRepositoryStatus: 'git:status:summary',
  getStatus: 'git:status:get',
  getFileDiff: 'git:diff:file',
  stageFile: 'git:stage:file',
  unstageFile: 'git:unstage:file',
  commitStaged: 'git:commit:staged',
  createBranch: 'git:branch:create',
  switchBranch: 'git:branch:switch',
  fetch: 'git:remote:fetch',
  pull: 'git:remote:pull',
  push: 'git:remote:push',
  getRecentCommits: 'git:commits:recent'
} as const

export type SourceControlApi = {
  connectRepository: () => Promise<GitConnectRepositoryResult>
  getRepository: () => Promise<GitRepository | null>
  getBranches: () => Promise<GitBranch[]>
  getCurrentBranch: () => Promise<GitBranch | null>
  getRepositoryStatus: () => Promise<GitRepositoryStatusCounts>
  getStatus: () => Promise<GitStatusSummary>
  getFileDiff: (request: GitFileDiffRequest) => Promise<GitFileDiff>
  stageFile: (request: GitFileOperation) => Promise<GitStatusSummary>
  unstageFile: (request: GitFileOperation) => Promise<GitStatusSummary>
  commitStaged: (request: GitCommitRequest) => Promise<GitCommitResult>
  createBranch: (request: GitBranchOperation) => Promise<GitStatusSummary>
  switchBranch: (request: GitBranchOperation) => Promise<GitStatusSummary>
  fetch: () => Promise<GitRemoteOperationResult>
  pull: () => Promise<GitRemoteOperationResult>
  push: () => Promise<GitRemoteOperationResult>
  getRecentCommits: (limit?: number) => Promise<GitCommit[]>
}
