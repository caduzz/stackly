import type { Session } from 'electron'

function isSecureWebUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function configureSessionPermissions(session: Session): () => void {
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission === 'mediaKeySystem') {
      return isSecureWebUrl(details.requestingUrl) || isSecureWebUrl(details.securityOrigin) || isSecureWebUrl(requestingOrigin)
    }
    return false
  })
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === 'mediaKeySystem') {
      callback(isSecureWebUrl(details.requestingUrl) || isSecureWebUrl(webContents.getURL()))
      return
    }
    callback(false)
  })
  return () => {
    session.setPermissionCheckHandler(null)
    session.setPermissionRequestHandler(null)
  }
}
