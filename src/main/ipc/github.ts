import { ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { githubActionsRunListRequestSchema, githubChannels, githubIssueListRequestSchema, githubPullRequestCreateRequestSchema, githubPullRequestDetailRequestSchema, githubPullRequestListRequestSchema, githubRepositoryRequestSchema } from '../../shared/contracts/github'
import type { GitHubProvider } from '../github/github.provider'

export function registerGitHubIpc(allowedSenderIds: Set<number>, github: GitHubProvider): void {
  function assertShell(event: IpcMainInvokeEvent): void {
    if (!allowedSenderIds.has(event.sender.id) || event.senderFrame !== event.sender.mainFrame) {
      throw new Error('GitHub is available only to the local shell')
    }
  }

  ipcMain.handle(githubChannels.getStatus, (event) => {
    assertShell(event)
    return github.getStatus()
  })

  ipcMain.handle(githubChannels.getRepository, (event, raw: unknown) => {
    assertShell(event)
    return github.getRepository(githubRepositoryRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.listPullRequests, (event, raw: unknown) => {
    assertShell(event)
    return github.listPullRequests(githubPullRequestListRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.getPullRequest, (event, raw: unknown) => {
    assertShell(event)
    return github.getPullRequest(githubPullRequestDetailRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.createPullRequest, (event, raw: unknown) => {
    assertShell(event)
    return github.createPullRequest(githubPullRequestCreateRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.listIssues, (event, raw: unknown) => {
    assertShell(event)
    return github.listIssues(githubIssueListRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.listActionsRuns, (event, raw: unknown) => {
    assertShell(event)
    return github.listActionsRuns(githubActionsRunListRequestSchema.parse(raw))
  })

  ipcMain.handle(githubChannels.startLogin, (event) => {
    assertShell(event)
    return github.startLogin()
  })

  ipcMain.handle(githubChannels.cancelLogin, (event) => {
    assertShell(event)
    return github.cancelLogin()
  })

  ipcMain.handle(githubChannels.disconnect, (event) => {
    assertShell(event)
    return github.disconnect()
  })

  ipcMain.handle(githubChannels.refreshProfile, (event) => {
    assertShell(event)
    return github.refreshProfile()
  })

  ipcMain.handle(githubChannels.openProfile, async (event) => {
    assertShell(event)
    const profileUrl = github.getStatus().profileUrl
    if (!profileUrl) throw new Error('No GitHub profile is available')
    await shell.openExternal(profileUrl)
  })

  ipcMain.handle(githubChannels.openAuthorizationUrl, async (event) => {
    assertShell(event)
    const authorization = github.getStatus().authorization
    if (!authorization) throw new Error('No GitHub authorization is active')
    await shell.openExternal(authorization.verificationUri)
  })
}
