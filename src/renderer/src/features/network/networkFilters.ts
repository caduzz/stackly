import type { NetworkEntry } from '../../../../shared/contracts/browser'

export const networkFilters = ['All', 'Fetch/XHR', 'JS', 'CSS', 'Img', 'Doc'] as const
export type NetworkFilter = typeof networkFilters[number]

const types: Partial<Record<NetworkFilter, string[]>> = {
  'Fetch/XHR': ['Fetch', 'XHR'],
  JS: ['Script'],
  CSS: ['Stylesheet'],
  Img: ['Image'],
  Doc: ['Document']
}

export function filterNetworkEntries(entries: NetworkEntry[], filter: NetworkFilter, query: string): NetworkEntry[] {
  const text = query.trim().toLocaleLowerCase()
  return entries.filter((entry) => {
    if (filter !== 'All' && !types[filter]?.includes(entry.type ?? '')) return false
    return !text || [entry.url, entry.method, entry.status, entry.type].join(' ').toLocaleLowerCase().includes(text)
  })
}

export function requestName(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch { return url }
}

export function durationLabel(duration: number | undefined): string {
  if (duration === undefined) return '—'
  if (duration < 1) return '<1 ms'
  if (duration < 1000) return `${Math.round(duration)} ms`
  return `${(duration / 1000).toFixed(1)} s`
}

export function statusTone(entry: NetworkEntry): string {
  if (entry.blockedBy === 'adblock') return 'blocked'
  if (entry.failed || (entry.status !== undefined && entry.status >= 400)) return 'error'
  if (entry.status !== undefined && entry.status >= 300) return 'warning'
  if (entry.status !== undefined && entry.status >= 200) return 'success'
  return 'muted'
}
