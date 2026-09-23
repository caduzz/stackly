import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { EnvironmentConfig, Workspace } from '../../../shared/contracts/browser'
import { browserDom } from '../browserDomController'

type Props = { workspace: Workspace | undefined; currentUrl: string }

export function EnvironmentSwitcher({ workspace, currentUrl }: Props): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [kind, setKind] = useState<EnvironmentConfig['kind']>('custom')
  const [error, setError] = useState('')
  let currentOrigin = ''
  try { currentOrigin = new URL(currentUrl).origin } catch { /* Blank tab has no current environment. */ }
  const activeEnvironment = workspace?.environments.find((item) => item.id === workspace.activeEnvironmentId)
  const currentEnvironmentId = activeEnvironment && new URL(activeEnvironment.baseUrl).origin === currentOrigin
    ? activeEnvironment.id
    : workspace?.environments.find((item) => new URL(item.baseUrl).origin === currentOrigin)?.id

  function resetForm(): void {
    setName(''); setBaseUrl(''); setKind('custom'); setAdding(false); setEditingId(null); setError('')
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    try {
      const config = { name, baseUrl: normalizeBaseUrl(baseUrl), kind }
      if (editingId) await window.devBrowser.environments.update(editingId, config)
      else await window.devBrowser.environments.add(config)
      resetForm()
    } catch {
      setError('Enter a name and an HTTP(S) origin, for example localhost:3000 or https://example.com.')
    }
  }

  function edit(environment: Workspace['environments'][number]): void {
    setEditingId(environment.id); setAdding(false); setName(environment.name); setBaseUrl(environment.baseUrl); setKind(environment.kind); setError('')
  }

  function remove(id: string, environmentName: string): void {
    if (!window.confirm(`Delete environment “${environmentName}”?`)) return
    void window.devBrowser.environments.delete(id).then(() => { if (editingId === id) resetForm() }).catch(() => setError('Could not delete this environment.'))
  }

  return <section className="environment-section" aria-label="Environments">
    <div className="environment-heading">
      <span>Environments</span>
      <button type="button" className="environment-add" onClick={() => { if (adding || editingId) resetForm(); else { resetForm(); setAdding(true) } }} aria-label={adding || editingId ? 'Cancel environment form' : 'Add environment'} data-tooltip={adding || editingId ? 'Cancel' : 'Add environment'}>{adding || editingId ? <X size={14} strokeWidth={1.75} /> : <Plus size={14} strokeWidth={1.75} />}</button>
    </div>
    {(adding || editingId) && <form className="environment-form" onSubmit={(event) => { void save(event) }}>
      <input aria-label="Environment name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <input aria-label="Base URL" placeholder="localhost:3000" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      <select aria-label="Environment kind" value={kind} onChange={(event) => setKind(event.target.value as EnvironmentConfig['kind'])}>
        <option value="local">Local</option><option value="staging">Staging</option><option value="production">Production</option><option value="custom">Custom</option>
      </select>
      <div className="environment-form-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit">{editingId ? 'Save' : 'Add environment'}</button></div>
    </form>}
    {workspace?.environments.map((environment) => {
      const selected = currentEnvironmentId === environment.id
      return <div key={environment.id} className={`environment-row${selected ? ' is-active' : ''}`}>
        <button type="button" className="environment-item" aria-pressed={selected} data-tooltip={environment.baseUrl} onClick={() => { void window.devBrowser.environments.select(environment.id, currentUrl).then((url) => browserDom.navigate(url)).then(() => setError('')).catch(() => setError('Could not open this environment.')) }}>
          <span className={`environment-dot environment-dot--${environment.kind}`} aria-hidden="true" /><span>{environment.name}</span>
        </button>
        <button type="button" className="environment-action" aria-label={`Edit ${environment.name}`} data-tooltip="Edit environment" onClick={() => edit(environment)}><Pencil size={12} /></button>
        <button type="button" className="environment-action environment-action--delete" aria-label={`Delete ${environment.name}`} data-tooltip="Delete environment" onClick={() => remove(environment.id, environment.name)}><Trash2 size={12} /></button>
      </div>
    })}
    {error && <p className="environment-error" role="alert">{error}</p>}
  </section>
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  const url = new URL(withProtocol)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol')
  return url.origin
}
