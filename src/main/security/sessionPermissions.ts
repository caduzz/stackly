import type { Session } from 'electron'

export function denySessionPermissions(session: Session): () => void {
  session.setPermissionCheckHandler(() => false)
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  return () => {
    session.setPermissionCheckHandler(null)
    session.setPermissionRequestHandler(null)
  }
}
