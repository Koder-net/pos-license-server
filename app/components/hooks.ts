'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from './ui'

/**
 * Polling data hook. `intervalMs` drives the near-live refresh used across the
 * panel (logs poll fast, dashboards slow). Passing 0 disables auto-refresh.
 *
 * Refetching is driven by a `tick` counter rather than a stored callback, so
 * the fetch effect depends only on [url, tick] and never closes over stale
 * state. `reload()` simply bumps the tick.
 */
export function usePolling<T>(url: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    void (async () => {
      try {
        const result = await adminFetch<T>(url)
        if (cancelled) return
        setData(result)
        setError('')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url, tick])

  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  /** Refetch now. Never flips `loading` — refreshes stay flicker-free. */
  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, reload }
}
