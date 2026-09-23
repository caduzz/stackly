import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ProtectedContentDiagnostics as ProtectedContentDiagnosticsResult } from '../../../../shared/contracts/browser'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; diagnostics: ProtectedContentDiagnosticsResult }
  | { kind: 'error'; message: string }

function StatusPill({ value }: { value: boolean }): React.JSX.Element {
  return <span className={`drm-status${value ? ' is-ok' : ' is-missing'}`}>{value ? 'Available' : 'Unavailable'}</span>
}

function Field({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return <div className="drm-field">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
}

export function ProtectedContentDiagnostics(): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' })

  async function run(): Promise<void> {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', diagnostics: await window.devBrowser.drm.getDiagnostics() })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  useEffect(() => {
    void run()
  }, [])

  return <section className="drm-diagnostics" aria-label="Protected content diagnostics">
    <header>
      <div>
        <h2>DRM Diagnostics</h2>
        <p>Experimental Widevine and EME compatibility probe for the active Chromium target.</p>
      </div>
      <button type="button" onClick={() => void run()} disabled={state.kind === 'loading'}>
        <RefreshCw size={14} aria-hidden="true" />
        Refresh
      </button>
    </header>

    {state.kind === 'loading' ? <p className="drm-empty">Running diagnostics...</p> : null}
    {state.kind === 'error' ? <p className="drm-error">{state.message}</p> : null}
    {state.kind === 'ready' ? <DiagnosticsBody diagnostics={state.diagnostics} /> : null}
  </section>
}

function DiagnosticsBody({ diagnostics }: { diagnostics: ProtectedContentDiagnosticsResult }): React.JSX.Element {
  return <>
    <div className="drm-grid">
      <section>
        <h3>Runtime</h3>
        <dl>
          <Field label="Electron" value={diagnostics.runtime.electron} />
          <Field label="Chromium" value={diagnostics.runtime.chromium} />
          <Field label="Node" value={diagnostics.runtime.node} />
          <Field label="Platform" value={`${diagnostics.runtime.platform} ${diagnostics.runtime.arch}`} />
          <Field label="ECS components API" value={<StatusPill value={diagnostics.runtime.castlabsComponentsApi} />} />
        </dl>
      </section>

      <section>
        <h3>Active Target</h3>
        <dl>
          <Field label="WebContents" value={diagnostics.target?.webContentsId ?? 'None'} />
          <Field label="URL" value={diagnostics.target?.url || 'Blank'} />
          <Field label="Page title" value={diagnostics.pageSignals.title || 'Untitled'} />
          <Field label="Page errors" value={diagnostics.pageSignals.detectedErrorCodes.length > 0 ? diagnostics.pageSignals.detectedErrorCodes.join(', ') : 'None detected'} />
          <Field label="EME API" value={<StatusPill value={diagnostics.eme.hasRequestMediaKeySystemAccess} />} />
          <Field label="Widevine" value={<StatusPill value={diagnostics.widevine.available} />} />
          <Field label="HDCP 2.2 policy" value={diagnostics.eme.hdcpPolicyStatus ?? diagnostics.eme.hdcpPolicyError ?? 'Not reported'} />
        </dl>
      </section>

      <section>
        <h3>Browser Identity</h3>
        <dl>
          <Field label="User-Agent" value={diagnostics.browserIdentity?.userAgent ?? 'Unavailable'} />
          <Field label="Platform" value={diagnostics.browserIdentity?.platform ?? 'Unavailable'} />
          <Field label="Language" value={diagnostics.browserIdentity ? [diagnostics.browserIdentity.language, ...diagnostics.browserIdentity.languages].filter(Boolean).join(', ') : 'Unavailable'} />
          <Field label="Vendor" value={diagnostics.browserIdentity?.vendor || 'Unavailable'} />
          <Field label="UA brands" value={diagnostics.browserIdentity?.brands?.map((brand) => `${brand.brand} ${brand.version}`).join(', ') || 'Unavailable'} />
        </dl>
      </section>

      <section>
        <h3>Media Codecs</h3>
        <dl>
          <Field label="H.264 MP4" value={<StatusPill value={diagnostics.media.avcHighMp4} />} />
          <Field label="AAC MP4" value={<StatusPill value={diagnostics.media.aacMp4} />} />
          <Field label="VP9 WebM" value={<StatusPill value={diagnostics.media.vp9Webm} />} />
          <Field label="AV1 MP4" value={<StatusPill value={diagnostics.media.av1Mp4} />} />
        </dl>
      </section>

      <section>
        <h3>ECS Components</h3>
        <pre>{JSON.stringify(diagnostics.components.status, null, 2) || 'null'}</pre>
      </section>
    </div>

    {diagnostics.widevine.errorMessage ? <p className="drm-error">{diagnostics.widevine.errorName ? `${diagnostics.widevine.errorName}: ` : ''}{diagnostics.widevine.errorMessage}</p> : null}
    {diagnostics.errors.length > 0 ? <ul className="drm-list">{diagnostics.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
    <ul className="drm-list is-muted">{diagnostics.notes.map((note) => <li key={note}>{note}</li>)}</ul>
  </>
}
