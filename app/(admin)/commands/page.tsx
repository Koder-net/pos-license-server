'use client'

import { useState } from 'react'
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
  EmptyState,
  adminFetch,
} from '@/app/components/ui'
import { fmtRelative } from '@/lib/format'

interface CommandRow {
  id: number
  machine_id: string
  type: string
  payload: Record<string, unknown> | null
  status: string
  result: string | null
  created_at: string
  delivered_at: string | null
  acked_at: string | null
  hostname: string | null
  nickname: string | null
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/30',
  delivered: 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-500/30',
  acked: 'text-green-300 bg-green-500/15 ring-1 ring-green-500/30',
  failed: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',
}

export default function CommandsPage() {
  const [status, setStatus] = useState('all')
  const { data, loading, error, reload } = usePolling<{ commands: CommandRow[] }>(
    `/api/admin/commands${status === 'all' ? '' : `?status=${status}`}`,
    15_000
  )

  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('info')
  const [busy, setBusy] = useState(false)

  const broadcast = async () => {
    if (!confirm('Send this message to EVERY installation in the fleet?')) return
    setBusy(true)
    try {
      await adminFetch('/api/admin/commands', {
        method: 'POST',
        body: JSON.stringify({
          machine_ids: 'all',
          type: 'message',
          payload: { title, body, severity },
        }),
      })
      setBroadcastOpen(false)
      setTitle('')
      setBody('')
      reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Broadcast failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commands</h1>
          <p className="text-sm text-gray-500">Remote actions queued across the fleet</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="acked">Acknowledged</option>
            <option value="failed">Failed</option>
          </Select>
          <Button onClick={() => setBroadcastOpen(true)}>📢 Broadcast Message</Button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Device</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Payload</th>
                    <th className="text-left px-5 py-3">Created</th>
                    <th className="text-left px-5 py-3">Acked</th>
                    <th className="text-left px-5 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.commands ?? []).map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/70 hover:bg-gray-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-gray-200">{c.type}</td>
                      <td className="px-5 py-3 text-xs">
                        <Link href={`/installations/${c.machine_id}`} className="text-gray-300 hover:text-blue-400">
                          {c.nickname ?? c.hostname ?? `${c.machine_id.slice(0, 10)}…`}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={STATUS_STYLE[c.status] ?? ''}>{c.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs font-mono max-w-48 truncate">
                        {c.payload ? JSON.stringify(c.payload) : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{fmtRelative(c.created_at)}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{fmtRelative(c.acked_at)}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs max-w-48 truncate">{c.result ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data?.commands.length ?? 0) === 0 && <EmptyState>No commands yet.</EmptyState>}
          </>
        )}
      </Card>

      <Modal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} title="Broadcast to all installations">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            This queues a popup message for every registered device. Each shows it on its next heartbeat.
          </p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Title</label>
            <Input value={title} onChange={setTitle} placeholder="Notice from KODERNET" className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Severity</label>
            <Select value={severity} onChange={setSeverity} className="w-full">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={broadcast} disabled={busy || !body.trim()}>
              Send to Everyone
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
