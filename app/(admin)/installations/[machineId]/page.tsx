'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { usePolling } from '@/app/components/hooks'
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Spinner,
  OnlineDot,
  EmptyState,
  Meter,
  StatCard,
  adminFetch,
} from '@/app/components/ui'
import { AreaTrend, Point } from '@/app/components/Chart'
import {
  fmtDateTime,
  fmtRelative,
  fmtDate,
  fmtMoney,
  fmtNumber,
  fmtCompact,
  fmtBytes,
  fmtUptime,
  isExpired,
  TYPE_LABEL,
  TYPE_STYLE,
  LEVEL_STYLE,
} from '@/lib/format'

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
  created_at: string
  last_seen_at: string
  trial_started_at: string | null
  is_online: boolean
  is_locked: boolean
  lock_reason: string | null
  license_key: string | null
  license_type: string | null
  license_active: boolean | null
  license_expires_at: string | null
  license_activated_at: string | null
  customer_name: string | null
  installments_paid: number | null
}

interface Stats {
  db_size_mb: number | null
  disk_free_gb: number | null
  disk_total_gb: number | null
  uptime_seconds: number | null
  last_backup_at: string | null
  sales_today: number | null
  revenue_today: number | null
  sales_total: number | null
  revenue_total: number | null
  product_count: number | null
  customer_count: number | null
}

interface PosUser {
  pos_user_id: string
  username: string | null
  name: string | null
  role: string
  active: boolean
  last_login_at: string | null
}

interface PosBranch {
  pos_branch_id: string
  name: string | null
  address: string | null
  phone: string | null
  is_default: boolean
}

interface LogRow {
  id: number
  level: string
  category: string | null
  message: string
  created_at: string
  pos_created_at: string | null
}

interface CommandRow {
  id: number
  type: string
  status: string
  result: string | null
  created_at: string
  acked_at: string | null
}

interface Detail {
  installation: Installation
  stats: Stats | null
  users: PosUser[]
  branches: PosBranch[]
  dailyStats: { date: string; sales_count: number; revenue: number }[]
  logs: LogRow[]
  commands: CommandRow[]
}

const TABS = ['Overview', 'POS Users', 'Branches', 'Sales', 'Logs', 'Control'] as const
type Tab = (typeof TABS)[number]

const ROLE_STYLE: Record<string, string> = {
  admin: 'text-purple-300 bg-purple-500/15 ring-1 ring-purple-500/30',
  manager: 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30',
  cashier: 'text-gray-300 bg-gray-500/15 ring-1 ring-gray-500/30',
}

export default function InstallationDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>
}) {
  const { machineId } = use(params)
  const [tab, setTab] = useState<Tab>('Overview')
  // Logs tab polls fast for a live feel; the rest of the page is slower.
  const { data, loading, error, reload } = usePolling<Detail>(
    `/api/admin/installations/${machineId}`,
    tab === 'Logs' ? 10_000 : 30_000
  )

  const [busy, setBusy] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgSeverity, setMsgSeverity] = useState('info')
  const [lockReason, setLockReason] = useState('')
  const [nickname, setNickname] = useState<string | null>(null)
  const [logLevel, setLogLevel] = useState('all')

  if (loading && !data) return <Spinner />
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return null

  const inst = data.installation
  const stats = data.stats
  const name = inst.nickname ?? inst.hostname ?? machineId.slice(0, 12)

  const sendCommand = async (type: string, payload?: Record<string, unknown>) => {
    setBusy(true)
    try {
      await adminFetch('/api/admin/commands', {
        method: 'POST',
        body: JSON.stringify({ machine_ids: [machineId], type, payload }),
      })
      reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Command failed')
    } finally {
      setBusy(false)
    }
  }

  const saveNickname = async () => {
    setBusy(true)
    try {
      await adminFetch(`/api/admin/installations/${machineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nickname }),
      })
      reload()
      setNickname(null)
    } finally {
      setBusy(false)
    }
  }

  const diskPct =
    stats?.disk_total_gb && stats?.disk_free_gb
      ? ((stats.disk_total_gb - stats.disk_free_gb) / stats.disk_total_gb) * 100
      : null

  const salesPoints: Point[] = data.dailyStats.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    value: d.revenue,
    secondary: { label: 'Sales', value: fmtNumber(d.sales_count) },
  }))

  const visibleLogs = data.logs.filter((l) => logLevel === 'all' || l.level === logLevel)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/installations" className="text-xs text-gray-500 hover:text-white">
            ← All installations
          </Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
            {name}
            {inst.is_locked && (
              <Badge className="text-red-300 bg-red-500/15 ring-1 ring-red-500/30">🔒 Locked</Badge>
            )}
          </h1>
          <p className="text-sm text-gray-500 flex items-center gap-3 mt-1">
            <OnlineDot online={inst.is_online} />
            <span>·</span>
            <span>Last seen {fmtRelative(inst.last_seen_at)}</span>
            <span>·</span>
            <span className="font-mono text-xs">{machineId.slice(0, 24)}…</span>
          </p>
        </div>
      </div>

      {inst.is_locked && (
        <Card className="p-4 ring-red-500/40 bg-red-500/5">
          <p className="text-red-300 text-sm font-medium">This installation is remotely locked.</p>
          <p className="text-gray-400 text-sm mt-0.5">Reason shown to customer: {inst.lock_reason || '—'}</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit ring-1 ring-gray-800 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue Today" value={fmtMoney(stats?.revenue_today)} sub={`${stats?.sales_today ?? 0} sales`} />
            <StatCard label="Lifetime Revenue" value={fmtMoney(stats?.revenue_total)} sub={`${fmtNumber(stats?.sales_total)} sales`} />
            <StatCard label="Database Size" value={fmtBytes(stats?.db_size_mb)} sub={`${fmtNumber(stats?.product_count)} products`} />
            <StatCard label="Uptime" value={fmtUptime(stats?.uptime_seconds)} sub={`v${inst.app_version ?? '?'}`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold">Device</h2>
              <dl className="text-sm space-y-2">
                <Row label="Hostname" value={inst.hostname} />
                <Row label="Platform" value={`${inst.platform ?? '—'} ${inst.arch ?? ''} · ${inst.os_version ?? ''}`} />
                <Row label="CPU" value={inst.cpu_model} />
                <Row label="RAM" value={inst.total_ram_gb ? `${inst.total_ram_gb} GB` : null} />
                <Row label="IP address" value={inst.ip_address} mono />
                <Row
                  label="Location"
                  value={inst.city && inst.country ? `${inst.city}, ${inst.country}` : inst.country}
                />
                <Row label="First registered" value={fmtDate(inst.created_at)} />
                <Row label="Last backup" value={stats?.last_backup_at ? fmtRelative(stats.last_backup_at) : 'Never'} />
              </dl>

              <div className="pt-2 border-t border-gray-800">
                <label className="text-xs text-gray-500 block mb-1">Nickname (admin label)</label>
                <div className="flex gap-2">
                  <Input
                    value={nickname ?? inst.nickname ?? ''}
                    onChange={setNickname}
                    placeholder="e.g. Colombo Main Shop"
                    className="flex-1"
                  />
                  <Button onClick={saveNickname} disabled={busy || nickname === null} variant="secondary">
                    Save
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5 space-y-3">
                <h2 className="font-semibold">License</h2>
                {inst.license_key ? (
                  <dl className="text-sm space-y-2">
                    <Row label="Key" value={inst.license_key} mono />
                    <Row label="Customer" value={inst.customer_name} />
                    <Row
                      label="Type"
                      value={
                        <Badge className={TYPE_STYLE[inst.license_type ?? ''] ?? ''}>
                          {TYPE_LABEL[inst.license_type ?? ''] ?? inst.license_type}
                        </Badge>
                      }
                    />
                    <Row label="Activated" value={fmtDate(inst.license_activated_at)} />
                    <Row
                      label="Expires"
                      value={
                        inst.license_type === 'lifetime' ? (
                          <span className="text-purple-300">Never</span>
                        ) : inst.license_expires_at ? (
                          <span className={isExpired(inst.license_expires_at) ? 'text-orange-400' : ''}>
                            {fmtDate(inst.license_expires_at)}
                          </span>
                        ) : null
                      }
                    />
                    <Row label="Installments" value={`${inst.installments_paid ?? 0} paid`} />
                  </dl>
                ) : (
                  <div className="text-sm text-gray-400">
                    <p>No license — running on trial.</p>
                    <p className="text-gray-600 text-xs mt-1">Trial started {fmtDate(inst.trial_started_at)}</p>
                  </div>
                )}
              </Card>

              <Card className="p-5 space-y-3">
                <h2 className="font-semibold">Storage</h2>
                {diskPct !== null ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Disk used</span>
                      <span className="tabular-nums">{diskPct.toFixed(0)}%</span>
                    </div>
                    <Meter
                      pct={diskPct}
                      color={diskPct > 90 ? 'bg-red-500' : diskPct > 75 ? 'bg-yellow-500' : 'bg-blue-500'}
                    />
                    <p className="text-xs text-gray-500">
                      {stats?.disk_free_gb?.toFixed(1)} GB free of {stats?.disk_total_gb?.toFixed(1)} GB
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">No storage data reported yet.</p>
                )}
                <div className="pt-2 border-t border-gray-800 text-sm flex justify-between">
                  <span className="text-gray-400">POS database</span>
                  <span className="tabular-nums">{fmtBytes(stats?.db_size_mb)}</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── POS USERS ── */}
      {tab === 'POS Users' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Registered Users ({data.users.length})</h2>
            <p className="text-xs text-gray-500">Accounts that exist inside this POS installation</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.pos_user_id} className="border-b border-gray-800/70">
                  <td className="px-5 py-3 text-gray-200">{u.name}</td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-xs">{u.username}</td>
                  <td className="px-5 py-3">
                    <Badge className={ROLE_STYLE[u.role] ?? ROLE_STYLE.cashier}>{u.role}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {u.active ? (
                      <span className="text-green-400 text-xs">Active</span>
                    ) : (
                      <span className="text-gray-600 text-xs">Disabled</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtRelative(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.users.length === 0 && <EmptyState>No users reported yet. They sync on the next heartbeat.</EmptyState>}
        </Card>
      )}

      {/* ── BRANCHES ── */}
      {tab === 'Branches' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Branches ({data.branches.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Address</th>
                <th className="text-left px-5 py-3">Phone</th>
                <th className="text-left px-5 py-3">Default</th>
              </tr>
            </thead>
            <tbody>
              {data.branches.map((b) => (
                <tr key={b.pos_branch_id} className="border-b border-gray-800/70">
                  <td className="px-5 py-3 text-gray-200">{b.name}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{b.address ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{b.phone ?? '—'}</td>
                  <td className="px-5 py-3">
                    {b.is_default && (
                      <Badge className="text-green-300 bg-green-500/15 ring-1 ring-green-500/30">Default</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.branches.length === 0 && <EmptyState>No branches reported. The multi-branch module may be off.</EmptyState>}
        </Card>
      )}

      {/* ── SALES ── */}
      {tab === 'Sales' && (
        <Card className="p-5">
          <h2 className="font-semibold mb-1">Daily Revenue</h2>
          <p className="text-xs text-gray-500 mb-3">Last 30 days · hover for sale counts</p>
          <AreaTrend
            data={salesPoints}
            height={220}
            format={(v) => fmtMoney(v)}
            axisFormat={(v) => fmtCompact(v)}
          />
        </Card>
      )}

      {/* ── LOGS ── */}
      {tab === 'Logs' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <h2 className="font-semibold">Live Log Stream</h2>
              <p className="text-xs text-gray-500">Latest 100 entries · auto-refreshes every 10s</p>
            </div>
            <Select value={logLevel} onChange={setLogLevel}>
              <option value="all">All levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
            </Select>
          </div>
          <div className="divide-y divide-gray-800/70 max-h-[600px] overflow-y-auto">
            {visibleLogs.map((l) => (
              <div key={l.id} className="px-5 py-2.5 hover:bg-gray-800/40 flex items-start gap-3">
                <span className="text-gray-600 font-mono text-xs shrink-0 w-32">
                  {fmtDateTime(l.pos_created_at ?? l.created_at)}
                </span>
                <Badge className={`${LEVEL_STYLE[l.level]} shrink-0`}>{l.level}</Badge>
                {l.category && <span className="text-gray-500 text-xs shrink-0 w-16">{l.category}</span>}
                <span className="text-gray-300 text-sm min-w-0 break-words">{l.message}</span>
              </div>
            ))}
          </div>
          {visibleLogs.length === 0 && <EmptyState>No log entries at this level.</EmptyState>}
        </Card>
      )}

      {/* ── CONTROL ── */}
      {tab === 'Control' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Remote Control</h2>
              <p className="text-xs text-gray-500">
                Commands are queued and picked up on the device&apos;s next heartbeat (within ~5 minutes).
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inst.is_locked ? (
                <ControlAction
                  title="Unlock application"
                  desc="Restore normal access on this device."
                  action={<Button onClick={() => sendCommand('unlock')} disabled={busy}>Unlock</Button>}
                />
              ) : (
                <ControlAction
                  title="Lock application"
                  desc="Blocks the POS with a full-screen notice."
                  action={
                    <Button variant="danger" onClick={() => setLockOpen(true)} disabled={busy}>
                      Lock
                    </Button>
                  }
                />
              )}

              <ControlAction
                title="Send message"
                desc="Show a popup inside the POS."
                action={<Button variant="secondary" onClick={() => setMsgOpen(true)}>Compose</Button>}
              />

              <ControlAction
                title="Force sync"
                desc="Ask the device to re-send telemetry now."
                action={
                  <Button variant="secondary" onClick={() => sendCommand('force_sync')} disabled={busy}>
                    Force Sync
                  </Button>
                }
              />

              <ControlAction
                title="Request logs"
                desc="Flush the device's buffered log queue."
                action={
                  <Button variant="secondary" onClick={() => sendCommand('request_logs')} disabled={busy}>
                    Request
                  </Button>
                }
              />

              <ControlAction
                title="Reset trial"
                desc="Restart the 3-day trial window."
                action={
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => confirm('Reset the trial on this device?') && sendCommand('reset_trial')}
                  >
                    Reset
                  </Button>
                }
              />

              <ControlAction
                title="Extend trial"
                desc="Grant extra trial days."
                action={
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const days = prompt('How many extra days?', '7')
                      if (days && Number(days) > 0) sendCommand('extend_trial', { days: Number(days) })
                    }}
                  >
                    Extend
                  </Button>
                }
              />

              {inst.license_key && (
                <ControlAction
                  title="Deactivate license"
                  desc="Revoke this key. The POS falls back to the activation screen."
                  action={
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        confirm(`Deactivate ${inst.license_key}? The customer will lose access.`) &&
                        sendCommand('deactivate_license')
                      }
                    >
                      Deactivate
                    </Button>
                  }
                />
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold">Command History</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-left px-5 py-3">Acked</th>
                  <th className="text-left px-5 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.commands.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800/70">
                    <td className="px-5 py-3 font-mono text-xs text-gray-200">{c.type}</td>
                    <td className="px-5 py-3">
                      <CommandStatus status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{fmtRelative(c.created_at)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{fmtRelative(c.acked_at)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{c.result ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.commands.length === 0 && <EmptyState>No commands sent to this device yet.</EmptyState>}
          </Card>
        </div>
      )}

      {/* Lock modal */}
      <Modal open={lockOpen} onClose={() => setLockOpen(false)} title="Lock this installation">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            The POS will show a full-screen lock as soon as it checks in. The license key is preserved —
            unlocking restores access immediately.
          </p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Reason shown to the customer</label>
            <Input
              value={lockReason}
              onChange={setLockReason}
              placeholder="e.g. Payment overdue — please contact KODERNET"
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLockOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                await sendCommand('lock', { reason: lockReason })
                setLockOpen(false)
                setLockReason('')
              }}
            >
              Lock Device
            </Button>
          </div>
        </div>
      </Modal>

      {/* Message modal */}
      <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title="Send message to device">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Title</label>
            <Input value={msgTitle} onChange={setMsgTitle} placeholder="Notice from KODERNET" className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Message</label>
            <textarea
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              rows={4}
              placeholder="Your message to the shop…"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Severity</label>
            <Select value={msgSeverity} onChange={setMsgSeverity} className="w-full">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMsgOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !msgBody.trim()}
              onClick={async () => {
                await sendCommand('message', { title: msgTitle, body: msgBody, severity: msgSeverity })
                setMsgOpen(false)
                setMsgTitle('')
                setMsgBody('')
              }}
            >
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-gray-200 text-right min-w-0 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-gray-600">—</span>}
      </dd>
    </div>
  )
}

function ControlAction({ title, desc, action }: { title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="bg-gray-800/40 ring-1 ring-gray-800 rounded-lg p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-gray-200">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  )
}

function CommandStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30',
    delivered: 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30',
    acked: 'text-green-300 bg-green-500/15 ring-1 ring-green-500/30',
    failed: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',
  }
  return <Badge className={styles[status] ?? ''}>{status}</Badge>
}
