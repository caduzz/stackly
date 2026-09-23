import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { gitBranchOperationSchema, gitChannels, gitCommitRequestSchema, gitFileDiffRequestSchema, gitFileOperationSchema } from '../../shared/contracts/git'
import type { GitService } from '../git/git.service'
import type { WorkspaceManager } from '../workspaces/WorkspaceManager'

export function registerGitIpc(allowedSenderIds: Set<number>, workspaceManagers: Map<number, WorkspaceManager>, git: GitService): void {
  function getWorkspaces(event: IpcMainInvokeEvent): WorkspaceManager {
    if (!allowedSenderIds.has(event.sender.id) || event.senderFrame !== event.sender.mainFrame) {
      throw new Error('Source Control is available only to the local shell')
    }
    const manager = workspaceManagers.get(event.sender.id)
    if (!manager) throw new Error('Workspace manager is unavailable')
    return manager
  }

  ipcMain.handle(gitChannels.connectRepository, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('Browser window is unavailable')
    const manager = getWorkspaces(event)
    const result = await git.connectRepository(window, manager.activeWorkspaceIdentity())
    if (result.status === 'connected') manager.setRepositoryPath(result.repository.rootPath)
    return result
  })

  ipcMain.handle(gitChannels.getRepository, (event) => {
    return git.getRepository(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.getBranches, (event) => git.getBranches(getWorkspaces(event).activeWorkspaceIdentity()))

  ipcMain.handle(gitChannels.getCurrentBranch, (event) => {
    return git.getCurrentBranch(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.getRepositoryStatus, (event) => {
    return git.getRepositoryStatus(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.getStatus, (event) => {
    return git.getStatus(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.getFileDiff, (event, raw: unknown) => {
    return git.getFileDiff(getWorkspaces(event).activeWorkspaceIdentity(), gitFileDiffRequestSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.stageFile, (event, raw: unknown) => {
    return git.stageFile(getWorkspaces(event).activeWorkspaceIdentity(), gitFileOperationSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.unstageFile, (event, raw: unknown) => {
    return git.unstageFile(getWorkspaces(event).activeWorkspaceIdentity(), gitFileOperationSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.commitStaged, (event, raw: unknown) => {
    return git.commitStaged(getWorkspaces(event).activeWorkspaceIdentity(), gitCommitRequestSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.createBranch, (event, raw: unknown) => {
    return git.createBranch(getWorkspaces(event).activeWorkspaceIdentity(), gitBranchOperationSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.switchBranch, (event, raw: unknown) => {
    return git.switchBranch(getWorkspaces(event).activeWorkspaceIdentity(), gitBranchOperationSchema.parse(raw))
  })

  ipcMain.handle(gitChannels.fetch, (event) => {
    return git.fetch(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.pull, (event) => {
    return git.pull(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.push, (event) => {
    return git.push(getWorkspaces(event).activeWorkspaceIdentity())
  })

  ipcMain.handle(gitChannels.getRecentCommits, (event, limit: unknown) => {
    return git.getRecentCommits(getWorkspaces(event).activeWorkspaceIdentity(), typeof limit === 'number' ? limit : undefined)
  })
}
