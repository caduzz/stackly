type BrowserDomController = {
  navigate: (url: string) => Promise<void>
  back: () => Promise<void>
  forward: () => Promise<void>
  reload: () => Promise<void>
}

let controller: BrowserDomController = {
  navigate: (url) => window.devBrowser.navigation.navigate(url),
  back: () => window.devBrowser.navigation.back(),
  forward: () => window.devBrowser.navigation.forward(),
  reload: () => window.devBrowser.navigation.reload()
}

export function setBrowserDomController(next: BrowserDomController): void {
  controller = next
}

export const browserDom = {
  navigate: (url: string): Promise<void> => controller.navigate(url),
  back: (): Promise<void> => controller.back(),
  forward: (): Promise<void> => controller.forward(),
  reload: (): Promise<void> => controller.reload()
}
