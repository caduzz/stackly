import type { DevBrowserApi } from './contracts/browser'
import type React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean | string
        webpreferences?: string
      }
    }
  }

  interface Window {
    devBrowser: DevBrowserApi
  }
}
