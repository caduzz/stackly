import { environmentConfigSchema, type Environment } from '../../shared/contracts/browser'

export function environmentDestination(currentUrl: string, environment: Environment): string {
  const base = new URL(environmentConfigSchema.shape.baseUrl.parse(environment.baseUrl))
  if (currentUrl) {
    try {
      const current = new URL(currentUrl)
      if (current.protocol === 'http:' || current.protocol === 'https:') {
        base.pathname = current.pathname
        base.search = current.search
        base.hash = current.hash
      }
    } catch { /* An empty or invalid current page opens the environment root. */ }
  }
  return base.href
}
