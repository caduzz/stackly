function chromeVersion(): string {
  return (process.versions as NodeJS.ProcessVersions & { chrome?: string }).chrome ?? '152.0.0.0'
}

function platformToken(): string {
  if (process.platform === 'darwin') return 'Macintosh; Intel Mac OS X 10_15_7'
  if (process.platform === 'linux') return 'X11; Linux x86_64'
  return 'Windows NT 10.0; Win64; x64'
}

export function chromeLikeUserAgent(): string {
  return `Mozilla/5.0 (${platformToken()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion()} Safari/537.36`
}
