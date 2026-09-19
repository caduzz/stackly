export function normalizeAddress(input: string): string {
  const value = input.trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(value)) return `http://${value}`
  if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(value)) return `https://${value}`
  return value
}
