import { z } from 'zod'

export const githubConnectionStateSchema = z.enum(['disconnected', 'connecting', 'connected', 'error'])
export type GitHubConnectionState = z.infer<typeof githubConnectionStateSchema>

export const githubAuthorizationSchema = z.strictObject({
  userCode: z.string().trim().min(1).max(64),
  verificationUri: z.url(),
  expiresAt: z.iso.datetime()
})
export type GitHubAuthorization = z.infer<typeof githubAuthorizationSchema>

export const githubProviderStatusSchema = z.strictObject({
  state: githubConnectionStateSchema,
  username: z.string().trim().min(1).max(100).nullable(),
  displayName: z.string().trim().min(1).max(200).nullable(),
  avatarUrl: z.url().nullable(),
  profileUrl: z.url().nullable(),
  authorization: githubAuthorizationSchema.nullable(),
  error: z.string().trim().min(1).max(500).nullable()
})
export type GitHubProviderStatus = z.infer<typeof githubProviderStatusSchema>

export const githubConnectionMetadataSchema = githubProviderStatusSchema.pick({
  username: true,
  displayName: true,
  avatarUrl: true,
  profileUrl: true
})
export type GitHubConnectionMetadata = z.infer<typeof githubConnectionMetadataSchema>

export const githubRepositoryRequestSchema = z.strictObject({
  owner: z.string().trim().min(1).max(100),
  repository: z.string().trim().min(1).max(200)
})
export type GitHubRepositoryRequest = z.infer<typeof githubRepositoryRequestSchema>

export const githubRepositoryMetadataSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  owner: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable(),
  visibility: z.enum(['public', 'private', 'internal']),
  defaultBranch: z.string().trim().min(1).max(255),
  url: z.url(),
  updatedAt: z.iso.datetime()
})
export type GitHubRepositoryMetadata = z.infer<typeof githubRepositoryMetadataSchema>

export const githubPullRequestStateSchema = z.enum(['open', 'closed'])
export type GitHubPullRequestState = z.infer<typeof githubPullRequestStateSchema>

export const githubPullRequestListRequestSchema = githubRepositoryRequestSchema.extend({
  state: githubPullRequestStateSchema,
  page: z.number().int().min(1).max(1000),
  perPage: z.number().int().min(1).max(50)
})
export type GitHubPullRequestListRequest = z.infer<typeof githubPullRequestListRequestSchema>

export const githubPullRequestSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(100),
  head: z.string().trim().min(1).max(255),
  base: z.string().trim().min(1).max(255),
  state: githubPullRequestStateSchema,
  url: z.url(),
  updatedAt: z.iso.datetime()
})
export type GitHubPullRequest = z.infer<typeof githubPullRequestSchema>

export const githubPullRequestPageSchema = z.strictObject({
  items: z.array(githubPullRequestSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(50),
  hasNextPage: z.boolean()
})
export type GitHubPullRequestPage = z.infer<typeof githubPullRequestPageSchema>

export const githubPullRequestDetailRequestSchema = githubRepositoryRequestSchema.extend({
  number: z.number().int().positive()
})
export type GitHubPullRequestDetailRequest = z.infer<typeof githubPullRequestDetailRequestSchema>

export const githubPullRequestCommitSchema = z.strictObject({
  sha: z.string().trim().min(7).max(64),
  message: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(100),
  authoredAt: z.iso.datetime(),
  url: z.url()
})
export type GitHubPullRequestCommit = z.infer<typeof githubPullRequestCommitSchema>

export const githubPullRequestFileSchema = z.strictObject({
  filename: z.string().trim().min(1).max(500),
  status: z.string().trim().min(1).max(40),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative()
})
export type GitHubPullRequestFile = z.infer<typeof githubPullRequestFileSchema>

export const githubPullRequestChecksSchema = z.strictObject({
  state: z.enum(['passing', 'failing', 'pending', 'none']),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative()
})
export type GitHubPullRequestChecks = z.infer<typeof githubPullRequestChecksSchema>

export const githubPullRequestDetailSchema = githubPullRequestSchema.extend({
  body: z.string().max(10000).nullable(),
  createdAt: z.iso.datetime(),
  merged: z.boolean(),
  commits: z.array(githubPullRequestCommitSchema),
  files: z.array(githubPullRequestFileSchema),
  checks: githubPullRequestChecksSchema.nullable()
})
export type GitHubPullRequestDetail = z.infer<typeof githubPullRequestDetailSchema>

export const githubPullRequestCreateRequestSchema = githubRepositoryRequestSchema.extend({
  title: z.string().trim().min(1).max(500),
  body: z.string().max(10000),
  base: z.string().trim().min(1).max(255),
  head: z.string().trim().min(1).max(255)
})
export type GitHubPullRequestCreateRequest = z.infer<typeof githubPullRequestCreateRequestSchema>

export const githubPullRequestCreateResultSchema = githubPullRequestSchema.pick({
  number: true,
  title: true,
  url: true
})
export type GitHubPullRequestCreateResult = z.infer<typeof githubPullRequestCreateResultSchema>

export const githubIssueStateSchema = z.enum(['open', 'closed', 'all'])
export type GitHubIssueState = z.infer<typeof githubIssueStateSchema>

export const githubIssueListRequestSchema = githubRepositoryRequestSchema.extend({
  state: githubIssueStateSchema,
  page: z.number().int().min(1).max(1000),
  perPage: z.number().int().min(1).max(50)
})
export type GitHubIssueListRequest = z.infer<typeof githubIssueListRequestSchema>

export const githubIssueSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.string().trim().min(1).max(100)),
  assignee: z.string().trim().min(1).max(100).nullable(),
  author: z.string().trim().min(1).max(100),
  url: z.url(),
  updatedAt: z.iso.datetime()
})
export type GitHubIssue = z.infer<typeof githubIssueSchema>

export const githubIssuePageSchema = z.strictObject({
  items: z.array(githubIssueSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(50),
  hasNextPage: z.boolean()
})
export type GitHubIssuePage = z.infer<typeof githubIssuePageSchema>

export const githubActionsRunListRequestSchema = githubRepositoryRequestSchema.extend({
  page: z.number().int().min(1).max(1000),
  perPage: z.number().int().min(1).max(50)
})
export type GitHubActionsRunListRequest = z.infer<typeof githubActionsRunListRequestSchema>

export const githubActionsRunSchema = z.strictObject({
  id: z.number().int().positive(),
  workflow: z.string().trim().min(1).max(200),
  branch: z.string().trim().min(1).max(255),
  commit: z.string().trim().min(7).max(80),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: z.enum(['success', 'failure', 'cancelled', 'skipped']).nullable(),
  url: z.url(),
  createdAt: z.iso.datetime()
})
export type GitHubActionsRun = z.infer<typeof githubActionsRunSchema>

export const githubActionsRunPageSchema = z.strictObject({
  items: z.array(githubActionsRunSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(50),
  hasNextPage: z.boolean()
})
export type GitHubActionsRunPage = z.infer<typeof githubActionsRunPageSchema>

export const githubContextSchema = z.strictObject({
  available: z.boolean(),
  reason: z.string().trim().min(1).max(500).nullable(),
  repository: githubRepositoryMetadataSchema.nullable(),
  currentBranch: z.string().trim().min(1).max(255).nullable(),
  openPullRequests: z.array(githubPullRequestSchema),
  recentIssues: z.array(githubIssueSchema),
  latestWorkflowRuns: z.array(githubActionsRunSchema)
})
export type GitHubContext = z.infer<typeof githubContextSchema>

export const githubChannels = {
  getStatus: 'github:provider:status',
  getRepository: 'github:repository:get',
  listPullRequests: 'github:pull-requests:list',
  getPullRequest: 'github:pull-requests:get',
  createPullRequest: 'github:pull-requests:create',
  listIssues: 'github:issues:list',
  listActionsRuns: 'github:actions:runs:list',
  startLogin: 'github:auth:start-login',
  cancelLogin: 'github:auth:cancel-login',
  disconnect: 'github:auth:disconnect',
  refreshProfile: 'github:profile:refresh',
  openProfile: 'github:profile:open',
  openAuthorizationUrl: 'github:auth:open-authorization-url'
} as const

export type GitHubApi = {
  getStatus: () => Promise<GitHubProviderStatus>
  getRepository: (request: GitHubRepositoryRequest) => Promise<GitHubRepositoryMetadata>
  listPullRequests: (request: GitHubPullRequestListRequest) => Promise<GitHubPullRequestPage>
  getPullRequest: (request: GitHubPullRequestDetailRequest) => Promise<GitHubPullRequestDetail>
  createPullRequest: (request: GitHubPullRequestCreateRequest) => Promise<GitHubPullRequestCreateResult>
  listIssues: (request: GitHubIssueListRequest) => Promise<GitHubIssuePage>
  listActionsRuns: (request: GitHubActionsRunListRequest) => Promise<GitHubActionsRunPage>
  startLogin: () => Promise<GitHubProviderStatus>
  cancelLogin: () => Promise<GitHubProviderStatus>
  disconnect: () => Promise<GitHubProviderStatus>
  refreshProfile: () => Promise<GitHubProviderStatus>
  openProfile: () => Promise<void>
  openAuthorizationUrl: () => Promise<void>
}
