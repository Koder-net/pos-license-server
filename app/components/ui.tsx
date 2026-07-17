'use client'

import { ReactNode } from 'react'

// ─── Data fetching ────────────────────────────────────────────────────────────

/**
 * Admin fetch wrapper. Auth rides on the httpOnly session cookie, so callers
 * never handle the secret. A 401 means the session lapsed — bounce to /login.
 */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-gray-900 ring-1 ring-gray-800 rounded-xl ${className}`}>{children}</div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </Card>
  )
}

export function Badge({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 ring-1 ring-gray-700',
    danger: 'bg-red-600/90 hover:bg-red-500 text-white',
    ghost: 'text-gray-400 hover:text-white hover:bg-gray-800',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  autoFocus,
  min,
  max,
}: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
  autoFocus?: boolean
  min?: number
  max?: number
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 ${className}`}
    />
  )
}

export function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      {children}
    </select>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-gray-900 ring-1 ring-gray-800 rounded-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-gray-500 text-sm">
      <span className="w-4 h-4 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      {label}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-12 text-center text-gray-600 text-sm">{children}</div>
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
      <span className={online ? 'text-green-400' : 'text-gray-500'}>
        {online ? 'Online' : 'Offline'}
      </span>
    </span>
  )
}

/** Horizontal usage meter — used for disk and installment progress. */
export function Meter({
  pct,
  color = 'bg-blue-500',
  className = '',
}: {
  pct: number
  color?: string
  className?: string
}) {
  return (
    <div className={`h-1.5 bg-gray-800 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}
