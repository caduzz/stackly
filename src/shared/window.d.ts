import type { DevBrowserApi } from './contracts/browser'

declare global {
  interface Window {
    devBrowser: DevBrowserApi
  }
}
