/** Shared display formatters for the admin panel. */

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "3m ago", "2h ago", "5d ago" — compact relative time for log/heartbeat rows. */
export function fmtRelative(d: string | null | undefined): string {
  if (!d) return 'never'
  const seconds = (Date.now() - new Date(d).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  return fmtDate(d)
}

export function fmtMoney(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  if (!Number.isFinite(v)) return 'Rs. 0'
  return `Rs. ${v.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}

export function fmtNumber(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return Number.isFinite(v) ? v.toLocaleString('en-US') : '0'
}

/** Compact form for chart axis ticks, where full currency strings don't fit. */
export function fmtCompact(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  if (!Number.isFinite(v)) return '0'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(v))
}

export function fmtBytes(mb: number | string | null | undefined): string {
  const v = typeof mb === 'string' ? parseFloat(mb) : (mb ?? 0)
  if (!Number.isFinite(v) || v === 0) return '—'
  if (v < 1024) return `${v.toFixed(1)} MB`
  return `${(v / 1024).toFixed(2)} GB`
}

export function fmtUptime(seconds: number | string | null | undefined): string {
  const s = typeof seconds === 'string' ? parseFloat(seconds) : (seconds ?? 0)
  if (!Number.isFinite(s) || s <= 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  return !!expiresAt && new Date(expiresAt) < new Date()
}

export const PLAN_TOTAL: Record<string, number> = { '6month': 6, '1year': 12 }

export const TYPE_LABEL: Record<string, string> = {
  lifetime: 'Lifetime',
  '1year': '1-Year Plan',
  '6month': '6-Month Plan',
}

export const TYPE_STYLE: Record<string, string> = {
  lifetime: 'text-purple-300 bg-purple-500/15 ring-1 ring-purple-500/30',
  '1year': 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30',
  '6month': 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-500/30',
}

export const LEVEL_STYLE: Record<string, string> = {
  critical: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',
  error: 'text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/30',
  warn: 'text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30',
  info: 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30',
  debug: 'text-gray-400 bg-gray-500/15 ring-1 ring-gray-500/30',
}
