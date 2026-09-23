import * as electron from 'electron'
import type { WebContents } from 'electron'
import type { ProtectedContentDiagnostics } from '../../shared/contracts/browser'

type ComponentsApi = {
  status?: () => unknown
}

type TargetDiagnostics = Pick<ProtectedContentDiagnostics, 'browserIdentity' | 'pageSignals' | 'eme' | 'widevine' | 'media' | 'errors'>

const diagnosticScript = String.raw`
  (async () => {
    const errors = []
    const mediaTypes = [
      ['avcHighMp4', 'video/mp4; codecs="avc1.640028"'],
      ['aacMp4', 'audio/mp4; codecs="mp4a.40.2"'],
      ['vp9Webm', 'video/webm; codecs="vp09.00.10.08"'],
      ['av1Mp4', 'video/mp4; codecs="av01.0.08M.08"']
    ]
    const media = Object.fromEntries(mediaTypes.map(([key, type]) => {
      const mediaSource = globalThis.MediaSource
      return [key, Boolean(mediaSource?.isTypeSupported?.(type))]
    }))
    const hasRequestMediaKeySystemAccess = typeof navigator.requestMediaKeySystemAccess === 'function'
    const pageText = document.body?.innerText ?? ''
    const detectedErrorCodes = [...new Set(pageText.match(/\b(?:[A-Z]\d{2,5}|M\d{4}-\d{4})\b/g) ?? [])]
    const browserIdentity = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages ?? []),
      vendor: navigator.vendor,
      brands: navigator.userAgentData?.brands?.map((item) => ({ brand: item.brand, version: item.version })),
      mobile: navigator.userAgentData?.mobile
    }
    let eme = { hasRequestMediaKeySystemAccess }
    let widevine = { available: false }
    if (hasRequestMediaKeySystemAccess) {
      try {
        const access = await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
          initDataTypes: ['cenc'],
          audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
          videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.640028"' }],
          distinctiveIdentifier: 'optional',
          persistentState: 'optional',
          sessionTypes: ['temporary']
        }])
        const configuration = access.getConfiguration()
        try {
          const mediaKeys = await access.createMediaKeys()
          if (typeof mediaKeys.getStatusForPolicy === 'function') {
            eme = { ...eme, hdcpPolicyStatus: await mediaKeys.getStatusForPolicy({ minHdcpVersion: '2.2' }) }
          }
        } catch (error) {
          eme = { ...eme, hdcpPolicyError: error instanceof Error ? error.message : String(error) }
        }
        widevine = {
          available: true,
          keySystem: access.keySystem,
          configuration: {
            initDataTypes: configuration.initDataTypes,
            audioCapabilities: configuration.audioCapabilities?.map((item) => ({ contentType: item.contentType, robustness: item.robustness })),
            videoCapabilities: configuration.videoCapabilities?.map((item) => ({ contentType: item.contentType, robustness: item.robustness })),
            distinctiveIdentifier: configuration.distinctiveIdentifier,
            persistentState: configuration.persistentState,
            sessionTypes: configuration.sessionTypes
          }
        }
      } catch (error) {
        widevine = {
          available: false,
          errorName: error instanceof DOMException ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
        errors.push(('Widevine EME probe failed: ' + (widevine.errorName ?? 'Error') + ' ' + (widevine.errorMessage ?? '')).trim())
      }
    } else {
      errors.push('navigator.requestMediaKeySystemAccess is unavailable in the active target.')
    }
    return {
      browserIdentity,
      pageSignals: {
        title: document.title,
        detectedErrorCodes
      },
      eme,
      widevine,
      media,
      errors
    }
  })()
`

export async function runProtectedContentDiagnostics(target: WebContents | null): Promise<ProtectedContentDiagnostics> {
  const components = (electron as typeof electron & { components?: ComponentsApi }).components
  const diagnostics: ProtectedContentDiagnostics = {
    runtime: {
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      castlabsComponentsApi: Boolean(components)
    },
    components: {
      available: Boolean(components),
      status: safeComponentStatus(components)
    },
    target: null,
    browserIdentity: null,
    pageSignals: { title: '', detectedErrorCodes: [] },
    eme: { hasRequestMediaKeySystemAccess: false },
    widevine: { available: false },
    media: {
      avcHighMp4: false,
      aacMp4: false,
      vp9Webm: false,
      av1Mp4: false
    },
    errors: [],
    notes: [
      'A positive EME/Widevine probe only confirms this Chromium target accepts the tested key-system configuration.',
      'It does not certify compatibility with Netflix or any other commercial streaming service.'
    ]
  }

  if (!target || target.isDestroyed()) {
    diagnostics.errors.push('No active Chromium target is available for the renderer-side DRM probe.')
    return diagnostics
  }

  diagnostics.target = {
    url: target.getURL() === 'about:blank' ? '' : target.getURL(),
    webContentsId: target.id
  }

  try {
    const targetDiagnostics = await target.executeJavaScript(diagnosticScript, true) as TargetDiagnostics
    diagnostics.browserIdentity = targetDiagnostics.browserIdentity
    diagnostics.pageSignals = targetDiagnostics.pageSignals
    diagnostics.eme = targetDiagnostics.eme
    diagnostics.widevine = targetDiagnostics.widevine
    diagnostics.media = targetDiagnostics.media
    diagnostics.errors.push(...targetDiagnostics.errors)
  } catch (error) {
    diagnostics.errors.push(`Failed to run DRM diagnostics in active target: ${error instanceof Error ? error.message : String(error)}`)
  }

  return diagnostics
}

function safeComponentStatus(components: ComponentsApi | undefined): unknown {
  if (!components?.status) return null
  try {
    return components.status()
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
