'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/app/components/hooks'
import {
  Card,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Spinner,
  EmptyState,
  Meter,
  adminFetch,
} from '@/app/components/ui'
import { fmtDate, isExpired, PLAN_TOTAL, TYPE_LABEL, TYPE_STYLE } from '@/lib/format'

interface License {
  id: number
  key: string
  machine_id: string | null
  type: string
  activated_at: string | null
  expires_at: string | null
  is_active: boolean
  customer_name: string | null
  notes: string | null
  created_at: string
  installments_paid: number
  hostname: string | null
  nickname: string | null
}

function statusBadge(l: License) {
  if (!l.is_active) return <Badge className="text-red-300 bg-red-500/15 ring-1 ring-red-500/30">Deactivated</Badge>
  if (isExpired(l.expires_at))
    return <Badge className="text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/30">Expired</Badge>
  if (l.machine_id) return <Badge className="text-green-300 bg-green-500/15 ring-1 ring-green-500/30">Active</Badge>
  return <Badge className="text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30">Unused</Badge>
}

export default function LicensesPage() {
  const { data, loading, error, reload } = usePolling<{ licenses: License[] }>('/api/keys/list')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Generate form
  const [genOpen, setGenOpen] = useState(false)
  const [genCount, setGenCount] = useState('1')
  const [genType, setGenType] = useState('lifetime')
  const [genCustomer, setGenCustomer] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [genResult, setGenResult] = useState<string[]>([])

  // Edit form
  const [editing, setEditing] = useState<License | null>(null)
  const [editCustomer, setEditCustomer] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editType, setEditType] = useState('lifetime')

  const licenses = useMemo(() => data?.licenses ?? [], [data])

  const stats = useMemo(
    () => ({
      total: licenses.length,
      active: licenses.filter((l) => l.machine_id && l.is_active && !isExpired(l.expires_at)).length,
      unused: licenses.filter((l) => !l.machine_id && l.is_active).length,
      expired: licenses.filter((l) => isExpired(l.expires_at) && l.is_active).length,
      deactivated: licenses.filter((l) => !l.is_active).length,
    }),
    [licenses]
  )

  const filtered = useMemo(
    () =>
      licenses.filter((l) => {
        const q = search.toLowerCase()
        const matchesSearch =
          !q || [l.key, l.customer_name, l.notes, l.hostname, l.nickname].some((f) => f?.toLowerCase().includes(q))
        const matchesFilter =
          filter === 'all' ||
          (filter === 'active' && l.machine_id && l.is_active && !isExpired(l.expires_at)) ||
          (filter === 'unused' && !l.machine_id && l.is_active) ||
          (filter === 'expired' && isExpired(l.expires_at) && l.is_active) ||
          (filter === 'deactivated' && !l.is_active)
        return matchesSearch && matchesFilter
      }),
    [licenses, search, filter]
  )

  const call = async (url: string, body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(true)
    setMsg('')
    try {
      const res = await adminFetch<{ message?: string }>(url, { method: 'POST', body: JSON.stringify(body) })
      setMsg(res.message ?? 'Done')
      reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleGenerate = async () => {
    setBusy(true)
    try {
      const res = await adminFetch<{ keys: string[] }>('/api/keys/generate', {
        method: 'POST',
        body: JSON.stringify({
          count: Number(genCount),
          type: genType,
          customer_name: genCustomer || undefined,
          notes: genNotes || undefined,
        }),
      })
      setGenResult(res.keys)
      setGenCustomer('')
      setGenNotes('')
      setGenCount('1')
      reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRecordPayment = async (l: License) => {
    const total = PLAN_TOTAL[l.type]
    const next = (l.installments_paid ?? 0) + 1
    const question =
      next >= total
        ? `Record FINAL payment (${next}/${total}) for ${l.key}?\n\nThis upgrades the license to LIFETIME.`
        : `Record payment ${next}/${total} for ${l.key}?\n\nThis extends access by 30 days.`
    await call('/api/keys/extend', { key: l.key }, question)
  }

  const openEdit = (l: License) => {
    setEditing(l)
    setEditCustomer(l.customer_name ?? '')
    setEditNotes(l.notes ?? '')
    setEditType(l.type)
  }

  if (loading && !data) return <Spinner />
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Licenses</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {licenses.length} keys</p>
        </div>
        <Button onClick={() => { setGenOpen(true); setGenResult([]) }}>+ Generate Keys</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Total Keys" value={stats.total} />
        <StatCard label="Active" value={stats.active} color="text-green-400" />
        <StatCard label="Unused" value={stats.unused} color="text-yellow-400" />
        <StatCard label="Expired" value={stats.expired} color="text-orange-400" />
        <StatCard label="Deactivated" value={stats.deactivated} color="text-red-400" />
      </div>

      {msg && (
        <Card className="p-3 px-4">
          <p className="text-sm text-gray-300">{msg}</p>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Input value={search} onChange={setSearch} placeholder="Search key, customer, notes…" className="w-72" />
        <Select value={filter} onChange={setFilter}>
          <option value="all">All licenses</option>
          <option value="active">Active</option>
          <option value="unused">Unused</option>
          <option value="expired">Expired</option>
          <option value="deactivated">Deactivated</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-3">Key</th>
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Device</th>
                <th className="text-left px-5 py-3">Expires</th>
                <th className="text-left px-5 py-3">Installments</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-gray-800/70 hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(l.key)}
                      title="Click to copy"
                      className="font-mono text-xs text-blue-300 hover:text-blue-200"
                    >
                      {l.key}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-300 text-xs">
                    {l.customer_name ?? <span className="text-gray-600">—</span>}
                    {l.notes && <div className="text-gray-600 truncate max-w-40">{l.notes}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={TYPE_STYLE[l.type] ?? ''}>{TYPE_LABEL[l.type] ?? l.type}</Badge>
                  </td>
                  <td className="px-5 py-3">{statusBadge(l)}</td>
                  <td className="px-5 py-3 text-xs">
                    {l.machine_id ? (
                      <Link href={`/installations/${l.machine_id}`} className="text-gray-300 hover:text-blue-400">
                        {l.nickname ?? l.hostname ?? `${l.machine_id.slice(0, 10)}…`}
                      </Link>
                    ) : (
                      <span className="text-gray-600">Unbound</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {l.type === 'lifetime' ? (
                      <span className="text-purple-300">Never</span>
                    ) : l.expires_at ? (
                      <span className={isExpired(l.expires_at) ? 'text-orange-400' : 'text-gray-400'}>
                        {fmtDate(l.expires_at)}
                      </span>
                    ) : (
                      <span className="text-gray-600">On activation</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs w-32">
                    {PLAN_TOTAL[l.type] ? (
                      <>
                        <span className="text-gray-300">
                          {l.installments_paid ?? 0} / {PLAN_TOTAL[l.type]} paid
                        </span>
                        <Meter
                          pct={((l.installments_paid ?? 0) / PLAN_TOTAL[l.type]) * 100}
                          color="bg-green-500"
                          className="mt-1"
                        />
                      </>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1 items-start text-xs">
                      {l.is_active && PLAN_TOTAL[l.type] && l.machine_id && (
                        <button
                          onClick={() => handleRecordPayment(l)}
                          disabled={busy}
                          className="text-green-400 hover:text-green-300 font-medium whitespace-nowrap"
                        >
                          + Record Payment
                        </button>
                      )}
                      <button onClick={() => openEdit(l)} className="text-gray-400 hover:text-white">
                        Edit
                      </button>
                      {l.machine_id && (
                        <button
                          onClick={() =>
                            call(
                              '/api/keys/unbind',
                              { key: l.key },
                              `Release ${l.key} from its current machine?\n\nThe customer will be able to activate it on a different computer.`
                            )
                          }
                          disabled={busy}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          Unbind
                        </button>
                      )}
                      {l.is_active ? (
                        <button
                          onClick={() => call('/api/keys/deactivate', { key: l.key }, `Deactivate ${l.key}?`)}
                          disabled={busy}
                          className="text-red-400 hover:text-red-300"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => call('/api/keys/reactivate', { key: l.key }, `Reactivate ${l.key}?`)}
                          disabled={busy}
                          className="text-green-400 hover:text-green-300"
                        >
                          Reactivate
                        </button>
                      )}
                      {!l.machine_id && !l.activated_at && (
                        <button
                          onClick={() =>
                            call('/api/keys/delete', { key: l.key }, `Permanently delete unused key ${l.key}?`)
                          }
                          disabled={busy}
                          className="text-gray-500 hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState>No licenses match these filters.</EmptyState>}
        </div>
      </Card>

      {/* Generate modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate license keys">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <Select value={genType} onChange={setGenType} className="w-full">
                <option value="lifetime">Lifetime (full payment)</option>
                <option value="6month">6-Month Plan (6 installments)</option>
                <option value="1year">1-Year Plan (12 installments)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Count</label>
              <Input type="number" min={1} max={50} value={genCount} onChange={setGenCount} className="w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer name</label>
            <Input value={genCustomer} onChange={setGenCustomer} placeholder="Optional" className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <Input value={genNotes} onChange={setGenNotes} placeholder="Optional" className="w-full" />
          </div>

          {genResult.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Generated — send to customer</p>
                <button
                  onClick={() => navigator.clipboard.writeText(genResult.join('\n'))}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Copy all
                </button>
              </div>
              {genResult.map((k) => (
                <code key={k} className="block text-green-400 font-mono text-sm">
                  {k}
                </code>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGenOpen(false)}>
              Close
            </Button>
            <Button onClick={handleGenerate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.key ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer name</label>
            <Input value={editCustomer} onChange={setEditCustomer} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <Input value={editNotes} onChange={setEditNotes} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Plan type</label>
            <Select value={editType} onChange={setEditType} className="w-full">
              <option value="lifetime">Lifetime</option>
              <option value="6month">6-Month Plan</option>
              <option value="1year">1-Year Plan</option>
            </Select>
            {editing && editType !== editing.type && (
              <p className="text-xs text-yellow-400 mt-1">
                {editType === 'lifetime'
                  ? 'Changing to Lifetime clears the expiry date.'
                  : 'Changing plan resets the expiry to 30 days from now (if already activated).'}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await call('/api/keys/update', {
                  key: editing!.key,
                  customer_name: editCustomer,
                  notes: editNotes,
                  type: editType,
                })
                setEditing(null)
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
