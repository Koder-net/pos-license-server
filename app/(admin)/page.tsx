'use client'

import Link from 'next/link'
import { usePolling } from '@/app/components/hooks'
import { Card, StatCard, Badge, Spinner } from '@/app/components/ui'
import { AreaTrend, BarList, Point } from '@/app/components/Chart'
import {
  fmtMoney,
  fmtNumber,
  fmtCompact,
  fmtRelative,
  fmtDate,
  fmtBytes,
  TYPE_LABEL,
  LEVEL_STYLE,
} from '@/lib/format'

interface Overview {
  fleet: { total_installs: number; online_now: number; offline_48h: number; locked_count: number }
  licenses: { total_keys: number; active: number; unused: number; expired: number; deactivated: number }
  revenue: {
    fleet_revenue_today: number
    fleet_revenue_total: number
    fleet_sales_today: number
    fleet_db_mb: number
  }
  expiringSoon: { key: string; customer_name: string | null; type: string; expires_at: string }[]
  staleDevices: { machine_id: string; hostname: string | null; nickname: string | null; last_seen_at: string }[]
  recentErrors: {
    id: number
    machine_id: string
    level: string
    message: string
    created_at: string
    hostname: string | null
    nickname: string | null
  }[]
  revenueTrend: { date: string; revenue: number; sales: number }[]
  activationTrend: { date: string; count: number }[]
  versionSpread: { version: string; count: number }[]
  recentActions: { action: string; target: string | null; created_at: string }[]
}

const shortDay = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

export default function DashboardPage() {
  const { data, loading, error } = usePolling<Overview>('/api/admin/overview', 30_000)

  if (loading && !data) return <Spinner />
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return null

  const revenuePoints: Point[] = data.revenueTrend.map((d) => ({
    label: shortDay(d.date),
    value: d.revenue,
    secondary: { label: 'Sales', value: fmtNumber(d.sales) },
  }))

  const activationPoints: Point[] = data.activationTrend.map((d) => ({
    label: shortDay(d.date),
    value: d.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Fleet-wide overview · refreshes every 30s</p>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Installations"
          value={fmtNumber(data.fleet.total_installs)}
          sub={`${data.fleet.online_now} online now`}
        />
        <StatCard
          label="Online Now"
          value={fmtNumber(data.fleet.online_now)}
          color="text-green-400"
          sub={`${data.fleet.offline_48h} quiet >48h`}
        />
        <StatCard
          label="Active Licenses"
          value={fmtNumber(data.licenses.active)}
          color="text-blue-400"
          sub={`${data.licenses.unused} unused · ${data.licenses.expired} expired`}
        />
        <StatCard
          label="Locked Devices"
          value={fmtNumber(data.fleet.locked_count)}
          color={data.fleet.locked_count > 0 ? 'text-red-400' : 'text-white'}
          sub="Remotely disabled"
        />
      </div>

      {/* Fleet business volume */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fleet Revenue Today"
          value={fmtMoney(data.revenue.fleet_revenue_today)}
          sub={`${fmtNumber(data.revenue.fleet_sales_today)} sales`}
        />
        <StatCard label="Fleet Revenue (Lifetime)" value={fmtMoney(data.revenue.fleet_revenue_total)} />
        <StatCard label="Keys Issued" value={fmtNumber(data.licenses.total_keys)} sub={`${data.licenses.deactivated} deactivated`} />
        <StatCard label="Total DB Size" value={fmtBytes(data.revenue.fleet_db_mb)} sub="Across all installs" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-1">Fleet Revenue</h2>
          <p className="text-xs text-gray-500 mb-3">Daily total across all installations · last 30 days</p>
          <AreaTrend
            data={revenuePoints}
            format={(v) => fmtMoney(v)}
            axisFormat={(v) => fmtCompact(v)}
          />
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-1">App Versions</h2>
          <p className="text-xs text-gray-500 mb-4">Installations per version</p>
          <BarList
            data={data.versionSpread.map((v) => ({ label: `v${v.version}`, value: v.count }))}
            format={(v) => fmtNumber(v)}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-1">License Activations</h2>
        <p className="text-xs text-gray-500 mb-3">New activations per day · last 90 days</p>
        <AreaTrend data={activationPoints} height={140} format={(v) => fmtNumber(v)} />
      </Card>

      {/* Needs attention */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Expiring in 7 Days</h2>
          {data.expiringSoon.length === 0 ? (
            <p className="text-gray-600 text-sm">Nothing expiring soon.</p>
          ) : (
            <div className="space-y-2.5">
              {data.expiringSoon.map((l) => (
                <Link
                  key={l.key}
                  href="/licenses"
                  className="flex items-center justify-between text-sm hover:bg-gray-800/50 -mx-2 px-2 py-1 rounded"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-blue-300 truncate">{l.key}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {l.customer_name ?? 'No customer'} · {TYPE_LABEL[l.type] ?? l.type}
                    </p>
                  </div>
                  <span className="text-orange-400 text-xs shrink-0 ml-2">{fmtDate(l.expires_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Gone Quiet (&gt;48h)</h2>
          {data.staleDevices.length === 0 ? (
            <p className="text-gray-600 text-sm">Every device has checked in recently.</p>
          ) : (
            <div className="space-y-2.5">
              {data.staleDevices.map((d) => (
                <Link
                  key={d.machine_id}
                  href={`/installations/${d.machine_id}`}
                  className="flex items-center justify-between text-sm hover:bg-gray-800/50 -mx-2 px-2 py-1 rounded"
                >
                  <span className="text-gray-300 truncate">
                    {d.nickname ?? d.hostname ?? d.machine_id.slice(0, 12)}
                  </span>
                  <span className="text-gray-500 text-xs shrink-0 ml-2">{fmtRelative(d.last_seen_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Recent Errors</h2>
          {data.recentErrors.length === 0 ? (
            <p className="text-gray-600 text-sm">No errors reported.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentErrors.map((l) => (
                <Link
                  key={l.id}
                  href={`/installations/${l.machine_id}`}
                  className="block text-sm hover:bg-gray-800/50 -mx-2 px-2 py-1 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={LEVEL_STYLE[l.level]}>{l.level}</Badge>
                    <span className="text-gray-500 text-xs truncate">
                      {l.nickname ?? l.hostname ?? l.machine_id.slice(0, 10)}
                    </span>
                    <span className="text-gray-600 text-xs ml-auto shrink-0">{fmtRelative(l.created_at)}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate mt-0.5">{l.message}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Admin audit */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Recent Admin Actions</h2>
        {data.recentActions.length === 0 ? (
          <p className="text-gray-600 text-sm">No actions recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.recentActions.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 font-mono text-xs">{a.action}</span>
                <span className="text-gray-500 text-xs truncate">{a.target ?? ''}</span>
                <span className="text-gray-600 text-xs ml-auto shrink-0">{fmtRelative(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
