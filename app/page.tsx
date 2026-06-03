'use client'

import { useState, useEffect, useCallback } from 'react'

interface License {
  id: number
  key: string
  machine_id: string | null
  activated_at: string | null
  is_active: boolean
  customer_name: string | null
  notes: string | null
  created_at: string
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')

  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [genCount, setGenCount] = useState(1)
  const [genCustomer, setGenCustomer] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [genResult, setGenResult] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const fetchLicenses = useCallback(async (s: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/keys/list', { headers: { 'x-admin-secret': s } })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setLicenses(data.licenses)
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
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
    } else {
      setAuthError('Incorrect admin secret')
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret')
    if (saved) {
      setSecret(saved)
      fetchLicenses(saved).then(() => setAuthed(true))
    }
  }, [fetchLicenses])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setGenResult([])
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({
          count: genCount,
          customer_name: genCustomer || undefined,
          notes: genNotes || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setGenResult(data.keys)
        setGenCustomer('')
        setGenNotes('')
        setGenCount(1)
        fetchLicenses(secret)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to generate keys')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeactivate = async (key: string) => {
    if (!confirm(`Deactivate key ${key}?`)) return
    const res = await fetch('/api/keys/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ key }),
    })
    if (res.ok) fetchLicenses(secret)
    else setError('Failed to deactivate')
  }

  const stats = {
    total: licenses.length,
    activated: licenses.filter((l) => l.machine_id && l.is_active).length,
    unactivated: licenses.filter((l) => !l.machine_id && l.is_active).length,
    deactivated: licenses.filter((l) => !l.is_active).length,
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white">BakeSmart License</h1>
          <p className="text-gray-400 text-sm">Enter your admin secret to continue</p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BakeSmart License Server</h1>
        <button
          onClick={() => { sessionStorage.removeItem('admin_secret'); setAuthed(false); setSecret('') }}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Keys', value: stats.total, color: 'text-white' },
          { label: 'Activated', value: stats.activated, color: 'text-green-400' },
          { label: 'Unactivated', value: stats.unactivated, color: 'text-yellow-400' },
          { label: 'Deactivated', value: stats.deactivated, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-lg">Generate New Keys</h2>
        <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 w-20 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-400 block mb-1">Customer Name</label>
            <input
              type="text"
              value={genCustomer}
              onChange={(e) => setGenCustomer(e.target.value)}
              placeholder="Optional"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-400 block mb-1">Notes</label>
            <input
              type="text"
              value={genNotes}
              onChange={(e) => setGenNotes(e.target.value)}
              placeholder="Optional"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {genResult.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Generated keys — copy and send to customer</p>
            {genResult.map((k) => (
              <div key={k} className="flex items-center justify-between">
                <code className="text-green-400 font-mono text-sm">{k}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(k)}
                  className="text-xs text-gray-400 hover:text-white ml-4"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-lg">All Licenses</h2>
          <button
            onClick={() => fetchLicenses(secret)}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm px-5 py-3">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-3">Key</th>
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Activated</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-blue-300">{l.key}</td>
                  <td className="px-5 py-3 text-gray-300">
                    {l.customer_name ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {!l.is_active ? (
                      <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Deactivated</span>
                    ) : l.machine_id ? (
                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Activated</span>
                    ) : (
                      <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">Unused</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {l.activated_at ? new Date(l.activated_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {l.is_active && (
                      <button
                        onClick={() => handleDeactivate(l.key)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-600">
                    No licenses yet. Generate your first key above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
