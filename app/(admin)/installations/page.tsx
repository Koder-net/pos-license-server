'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/app/components/hooks'
import { Card, Badge, Spinner, Input, Select, OnlineDot, EmptyState, Meter } from '@/app/components/ui'
import { fmtRelative, fmtBytes, fmtMoney, isExpired, TYPE_LABEL, TYPE_STYLE } from '@/lib/format'

interface Installation {
  machine_id: string
  hostname: string | null
  nickname: string | null
  platform: string | null
  os_version: string | null
  arch: string | null
  cpu_model: string | null
  total_ram_gb: number | null
  app_version: string | null
  ip_address: string | null
  country: string | null
  city: string | null
  last_seen_at: string
  is_online: boolean
  is_locked: boolean
  license_key: string | null
  license_type: string | null
  license_active: boolean | null
  license_expires_at: string | null
  customer_name: string | null
  db_size_mb: number | null
  disk_free_gb: number | null
  disk_total_gb: number | null
  revenue_today: number | null
  pos_user_count: number | null
  branch_count: number | null
  pending_commands: number
  trial_started_at: string | null
}

function statusBadge(i: Installation) {
  if (i.is_locked) return <Badge className="text-red-300 bg-red-500/15 ring-1 ring-red-500/30">Locked</Badge>
  if (!i.license_key) return <Badge className="text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30">Trial</Badge>
  if (!i.license_active) return <Badge className="text-red-300 bg-red-500/15 ring-1 ring-red-500/30">Deactivated</Badge>
  if (isExpired(i.license_expires_at))
    return <Badge className="text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/30">Expired</Badge>
  return <Badge className="text-green-300 bg-green-500/15 ring-1 ring-green-500/30">Licensed</Badge>
}

export default function InstallationsPage() {
  const { data, loading, error } = usePolling<{ installations: Installation[] }>(
    '/api/admin/installations',
    20_000
  )
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(() => {
    const list = data?.installations ?? []
    return list.filter((i) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        [i.hostname, i.nickname, i.machine_id, i.customer_name, i.license_key, i.city, i.country]
          .some((f) => f?.toLowerCase().includes(q))

      const matchesStatus =
        status === 'all' ||
        (status === 'online' && i.is_online) ||
        (status === 'offline' && !i.is_online) ||
        (status === 'locked' && i.is_locked) ||
        (status === 'trial' && !i.license_key) ||
        (status === 'licensed' && i.license_key && i.license_active && !isExpired(i.license_expires_at)) ||
        (status === 'expired' && isExpired(i.license_expires_at))

      return matchesSearch && matchesStatus
    })
  }, [data, search, status])

  if (loading && !data) return <Spinner />
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Installations</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} of {data?.installations.length ?? 0} devices
          </p>
        </div>
        <div className="flex gap-2">
          <Input value={search} onChange={setSearch} placeholder="Search host, customer, key, city…" className="w-72" />
          <Select value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="licensed">Licensed</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="locked">Locked</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-4 py-3">Device</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">License</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Storage</th>
                <th className="text-left px-4 py-3">Users</th>
                <th className="text-left px-4 py-3">Today</th>
                <th className="text-left px-4 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const diskPct =
                  i.disk_total_gb && i.disk_free_gb
                    ? ((i.disk_total_gb - i.disk_free_gb) / i.disk_total_gb) * 100
                    : null
                return (
                  <tr key={i.machine_id} className="border-b border-gray-800/70 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/installations/${i.machine_id}`} className="block group">
                        <div className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors flex items-center gap-2">
                          {i.nickname ?? i.hostname ?? 'Unknown'}
                          {i.pending_commands > 0 && (
                            <Badge className="text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30">
                              {i.pending_commands} queued
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-600 text-xs">
                          {i.platform} {i.arch} · v{i.app_version ?? '?'}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {statusBadge(i)}
                        <span className="text-xs">
                          <OnlineDot online={i.is_online} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {i.customer_name ?? <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {i.license_key ? (
                        <>
                          <div className="font-mono text-blue-300">{i.license_key}</div>
                          <Badge className={TYPE_STYLE[i.license_type ?? ''] ?? ''}>
                            {TYPE_LABEL[i.license_type ?? ''] ?? i.license_type}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div>{i.city && i.country ? `${i.city}, ${i.country}` : (i.country ?? 'Unknown')}</div>
                      <div className="text-gray-600 font-mono">{i.ip_address}</div>
                    </td>
                    <td className="px-4 py-3 text-xs w-32">
                      <div className="text-gray-400">DB {fmtBytes(i.db_size_mb)}</div>
                      {diskPct !== null ? (
                        <>
                          <Meter
                            pct={diskPct}
                            color={diskPct > 90 ? 'bg-red-500' : diskPct > 75 ? 'bg-yellow-500' : 'bg-blue-500'}
                            className="mt-1"
                          />
                          <div className="text-gray-600 mt-0.5">{i.disk_free_gb?.toFixed(0)} GB free</div>
                        </>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {i.pos_user_count ?? 0} users
                      <div className="text-gray-600">{i.branch_count ?? 0} branches</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">{fmtMoney(i.revenue_today)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtRelative(i.last_seen_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState>No installations match these filters.</EmptyState>}
        </div>
      </Card>
    </div>
  )
}
