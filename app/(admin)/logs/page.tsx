'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePolling } from '@/app/components/hooks'
import { Card, StatCard, Badge, Input, Select, Spinner, EmptyState } from '@/app/components/ui'
import { fmtDateTime, LEVEL_STYLE } from '@/lib/format'

interface LogRow {
  id: number
  machine_id: string
  level: string
  category: string | null
  message: string
  meta: unknown
  created_at: string
  pos_created_at: string | null
  hostname: string | null
  nickname: string | null
}

interface LogResponse {
  logs: LogRow[]
  counts: { total: number; critical: number; errors: number; warnings: number }
}

export default function LogsPage() {
  const [level, setLevel] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [live, setLive] = useState(true)

  const qs = new URLSearchParams()
  if (level !== 'all') qs.set('level', level)
  if (category !== 'all') qs.set('category', category)
  if (search.trim()) qs.set('search', search.trim())

  const { data, loading, error } = usePolling<LogResponse>(
    `/api/admin/logs?${qs.toString()}`,
    live ? 10_000 : 0
  )

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Logs</h1>
          <p className="text-sm text-gray-500">
            Fleet-wide event stream{live ? ' · refreshing every 10s' : ' · paused'}
          </p>
        </div>
        <button
          onClick={() => setLive((v) => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ring-1 ${
            live
              ? 'bg-green-500/15 text-green-300 ring-green-500/30'
              : 'bg-gray-800 text-gray-400 ring-gray-700'
          }`}
        >
          {live ? '● Live' : '❚❚ Paused'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Last 24h" value={data?.counts.total ?? 0} sub="All levels" />
        <StatCard label="Critical" value={data?.counts.critical ?? 0} color="text-red-400" sub="Last 24h" />
        <StatCard label="Errors" value={data?.counts.errors ?? 0} color="text-orange-400" sub="Last 24h" />
        <StatCard label="Warnings" value={data?.counts.warnings ?? 0} color="text-yellow-400" sub="Last 24h" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input value={search} onChange={setSearch} placeholder="Search messages…" className="w-72" />
        <Select value={level} onChange={setLevel}>
          <option value="all">All levels</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </Select>
        <Select value={category} onChange={setCategory}>
          <option value="all">All categories</option>
          <option value="system">System</option>
          <option value="auth">Auth</option>
          <option value="sale">Sale</option>
          <option value="print">Print</option>
          <option value="license">License</option>
          <option value="error">Error</option>
          <option value="sync">Sync</option>
        </Select>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <div className="divide-y divide-gray-800/70 max-h-[70vh] overflow-y-auto">
              {(data?.logs ?? []).map((l) => (
                <div key={l.id} className="px-5 py-2.5 hover:bg-gray-800/40 flex items-start gap-3 text-sm">
                  <span className="text-gray-600 font-mono text-xs shrink-0 w-32">
                    {fmtDateTime(l.pos_created_at ?? l.created_at)}
                  </span>
                  <Badge className={`${LEVEL_STYLE[l.level]} shrink-0`}>{l.level}</Badge>
                  <Link
                    href={`/installations/${l.machine_id}`}
                    className="text-gray-500 hover:text-blue-400 text-xs shrink-0 w-32 truncate"
                  >
                    {l.nickname ?? l.hostname ?? `${l.machine_id.slice(0, 10)}…`}
                  </Link>
                  {l.category && <span className="text-gray-600 text-xs shrink-0 w-16">{l.category}</span>}
                  <span className="text-gray-300 min-w-0 break-words">{l.message}</span>
                </div>
              ))}
            </div>
            {(data?.logs.length ?? 0) === 0 && <EmptyState>No log entries match these filters.</EmptyState>}
          </>
        )}
      </Card>
    </div>
  )
}
