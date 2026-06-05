'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installation {
  id: number
  machine_id: string
  hostname: string | null
  cpu_model: string | null
  platform: string | null
  os_version: string | null
  arch: string | null
  total_ram_gb: number | null
  app_version: string | null
  ip_address: string | null
  country: string | null
  city: string | null
  trial_started_at: string | null
  last_seen_at: string
  license_key: string | null
  created_at: string
  // joined from licenses
  license_type: string | null
  license_active: boolean | null
  license_expires_at: string | null
  customer_name: string | null
}

interface License {
  id: number
  key: string
  machine_id: string | null
  type: 'lifetime' | 'yearly' | 'monthly'
  activated_at: string | null
  expires_at: string | null
  is_active: boolean
  customer_name: string | null
  notes: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  lifetime: 'text-purple-400 bg-purple-900/40',
  yearly:   'text-blue-400 bg-blue-900/40',
  monthly:  'text-cyan-400 bg-cyan-900/40',
}

function isExpired(expiresAt: string | null) {
  return expiresAt && new Date(expiresAt) < new Date()
}

function trialDaysLeft(startedAt: string | null): number | null {
  if (!startedAt) return null
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 86400000
  return Math.max(0, 7 - Math.floor(elapsed))
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function installStatus(inst: Installation) {
  if (!inst.license_key) {
    const days = trialDaysLeft(inst.trial_started_at)
    if (days === null || days < 0) return <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Trial Expired</span>
    return <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">Trial ({days}d left)</span>
  }
  if (!inst.license_active) return <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Deactivated</span>
  if (isExpired(inst.license_expires_at)) return <span className="text-xs bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded-full">Expired</span>
  return <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Licensed</span>
}

function licenseStatusBadge(l: License) {
  if (!l.is_active)          return <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Deactivated</span>
  if (isExpired(l.expires_at)) return <span className="text-xs bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded-full">Expired</span>
  if (l.machine_id)          return <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Active</span>
  return <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">Unused</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'installs' | 'licenses'>('installs')

  // Installations state
  const [installations, setInstallations] = useState<Installation[]>([])
  const [installLoading, setInstallLoading] = useState(false)

  // License state
  const [licenses, setLicenses] = useState<License[]>([])
  const [licLoading, setLicLoading] = useState(false)
  const [licError, setLicError] = useState('')

  // Generate form
  const [genCount, setGenCount] = useState(1)
  const [genType, setGenType] = useState<'lifetime' | 'yearly' | 'monthly'>('lifetime')
  const [genCustomer, setGenCustomer] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [genResult, setGenResult] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const fetchInstallations = useCallback(async (s: string) => {
    setInstallLoading(true)
    try {
      const res = await fetch('/api/installations', { headers: { 'x-admin-secret': s } })
      if (res.ok) setInstallations((await res.json()).installations)
    } catch { /* ignore */ }
    finally { setInstallLoading(false) }
  }, [])

  const fetchLicenses = useCallback(async (s: string) => {
    setLicLoading(true)
    setLicError('')
    try {
      const res = await fetch('/api/keys/list', { headers: { 'x-admin-secret': s } })
      const data = await res.json()
      if (res.ok) setLicenses(data.licenses)
      else setLicError(data.error)
    } catch { setLicError('Failed to connect') }
    finally { setLicLoading(false) }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    const res = await fetch('/api/keys/list', { headers: { 'x-admin-secret': secret } })
    if (res.ok) {
      const data = await res.json()
      setLicenses(data.licenses)
      setAuthed(true)
      sessionStorage.setItem('admin_secret', secret)
      fetchInstallations(secret)
    } else {
      setAuthError('Incorrect admin secret')
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret')
    if (saved) {
      setSecret(saved)
      fetchLicenses(saved).then(() => setAuthed(true))
      fetchInstallations(saved)
    }
  }, [fetchLicenses, fetchInstallations])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setGenResult([])
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ count: genCount, type: genType, customer_name: genCustomer || undefined, notes: genNotes || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setGenResult(data.keys)
        setGenCustomer(''); setGenNotes(''); setGenCount(1)
        fetchLicenses(secret)
      } else { setLicError(data.error) }
    } catch { setLicError('Failed to generate') }
    finally { setGenerating(false) }
  }

  const handleDeactivate = async (key: string) => {
    if (!confirm(`Deactivate ${key}?`)) return
    await fetch('/api/keys/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ key }),
    })
    fetchLicenses(secret)
  }

  // ── Install stats
  const instStats = {
    total: installations.length,
    trial: installations.filter(i => !i.license_key && trialDaysLeft(i.trial_started_at)! > 0).length,
    trialExpired: installations.filter(i => !i.license_key && (trialDaysLeft(i.trial_started_at) ?? -1) <= 0).length,
    licensed: installations.filter(i => i.license_key && i.license_active && !isExpired(i.license_expires_at)).length,
    expired: installations.filter(i => i.license_key && isExpired(i.license_expires_at)).length,
  }

  // ── License stats
  const licStats = {
    total: licenses.length,
    active: licenses.filter(l => l.machine_id && l.is_active && !isExpired(l.expires_at)).length,
    unused: licenses.filter(l => !l.machine_id && l.is_active).length,
    expired: licenses.filter(l => isExpired(l.expires_at) && l.is_active).length,
    deactivated: licenses.filter(l => !l.is_active).length,
  }

  // ── Login screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">BakeSmart License</h1>
          <p className="text-gray-400 text-sm">Admin panel — enter your secret to continue</p>
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin secret"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors">
            Sign In
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BakeSmart License Server</h1>
        <button onClick={() => { sessionStorage.removeItem('admin_secret'); setAuthed(false); setSecret('') }}
          className="text-sm text-gray-400 hover:text-white transition-colors">Sign out</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
        {([['installs', 'Installations'], ['licenses', 'Licenses']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── INSTALLATIONS TAB ── */}
      {tab === 'installs' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Installs', value: instStats.total, color: 'text-white' },
              { label: 'In Trial', value: instStats.trial, color: 'text-yellow-400' },
              { label: 'Trial Expired', value: instStats.trialExpired, color: 'text-red-400' },
              { label: 'Licensed', value: instStats.licensed, color: 'text-green-400' },
              { label: 'Sub Expired', value: instStats.expired, color: 'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-lg">All Installations</h2>
              <button onClick={() => fetchInstallations(secret)} disabled={installLoading}
                className="text-sm text-gray-400 hover:text-white transition-colors">
                {installLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-4 py-3">Machine / Hostname</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Device</th>
                    <th className="text-left px-4 py-3">Location</th>
                    <th className="text-left px-4 py-3">IP</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">License</th>
                    <th className="text-left px-4 py-3">Trial Started</th>
                    <th className="text-left px-4 py-3">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {installations.map(inst => (
                    <tr key={inst.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-200">{inst.hostname ?? '—'}</div>
                        <div className="text-gray-500 text-xs font-mono">{inst.machine_id.slice(0, 16)}…</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{inst.customer_name ?? <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        <div>{inst.platform} {inst.arch}</div>
                        <div className="text-gray-600">{inst.os_version}</div>
                        <div>{inst.cpu_model?.slice(0, 28)}</div>
                        <div>{inst.total_ram_gb != null ? `${inst.total_ram_gb} GB RAM` : ''}</div>
                        <div className="text-gray-600">App v{inst.app_version}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {inst.city && inst.country ? `${inst.city}, ${inst.country}` : inst.country ?? <span className="text-gray-600">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{inst.ip_address ?? '—'}</td>
                      <td className="px-4 py-3">{installStatus(inst)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {inst.license_key
                          ? <><div className="font-mono text-blue-300">{inst.license_key}</div><div>{inst.license_type}</div></>
                          : <span className="text-gray-600">None</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmt(inst.trial_started_at)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtTime(inst.last_seen_at)}</td>
                    </tr>
                  ))}
                  {installations.length === 0 && !installLoading && (
                    <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-600">No installations registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── LICENSES TAB ── */}
      {tab === 'licenses' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Keys', value: licStats.total, color: 'text-white' },
              { label: 'Active', value: licStats.active, color: 'text-green-400' },
              { label: 'Unused', value: licStats.unused, color: 'text-yellow-400' },
              { label: 'Expired', value: licStats.expired, color: 'text-orange-400' },
              { label: 'Deactivated', value: licStats.deactivated, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Generate */}
          <div className="bg-gray-900 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-lg">Generate New Keys</h2>
            <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Type</label>
                <select value={genType} onChange={e => setGenType(e.target.value as typeof genType)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="lifetime">Lifetime</option>
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Count</label>
                <input type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 w-20 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-xs text-gray-400 block mb-1">Customer Name</label>
                <input type="text" value={genCustomer} onChange={e => setGenCustomer(e.target.value)} placeholder="Optional"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-xs text-gray-400 block mb-1">Notes</label>
                <input type="text" value={genNotes} onChange={e => setGenNotes(e.target.value)} placeholder="Optional"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={generating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors">
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </form>
            {genResult.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Generated keys — send to customer</p>
                {genResult.map(k => (
                  <div key={k} className="flex items-center justify-between">
                    <code className="text-green-400 font-mono text-sm">{k}</code>
                    <button onClick={() => navigator.clipboard.writeText(k)} className="text-xs text-gray-400 hover:text-white ml-4">Copy</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Licenses table */}
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-lg">All Licenses</h2>
              <button onClick={() => fetchLicenses(secret)} disabled={licLoading} className="text-sm text-gray-400 hover:text-white transition-colors">
                {licLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {licError && <p className="text-red-400 text-sm px-5 py-3">{licError}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-5 py-3">Key</th>
                    <th className="text-left px-5 py-3">Customer</th>
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Activated</th>
                    <th className="text-left px-5 py-3">Expires</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map(l => (
                    <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-blue-300">{l.key}</td>
                      <td className="px-5 py-3 text-gray-300">{l.customer_name ?? <span className="text-gray-600">—</span>}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[l.type] ?? ''}`}>
                          {l.type.charAt(0).toUpperCase() + l.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3">{licenseStatusBadge(l)}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{fmt(l.activated_at)}</td>
                      <td className="px-5 py-3 text-xs">
                        {l.type === 'lifetime'
                          ? <span className="text-purple-400">Never</span>
                          : l.expires_at
                            ? <span className={isExpired(l.expires_at) ? 'text-orange-400' : 'text-gray-400'}>{fmt(l.expires_at)}</span>
                            : <span className="text-gray-600">On activation</span>}
                      </td>
                      <td className="px-5 py-3">
                        {l.is_active && (
                          <button onClick={() => handleDeactivate(l.key)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {licenses.length === 0 && !licLoading && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-600">No licenses yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
