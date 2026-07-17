import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { ok, fail, preflight } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

const LEVELS = ['debug', 'info', 'warn', 'error', 'critical']
const MAX_BATCH = 200
const RETENTION_DAYS = 30

interface LogEntry {
  level?: string
  category?: string
  message?: string
  meta?: unknown
  created_at?: string
}

/** Batched log upload from the POS client (every ~60s, or immediately on errors). */
export async function POST(req: NextRequest) {
  let body: { machine_id?: string; logs?: LogEntry[] }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid body')
  }

  const { machine_id, logs } = body
  if (!machine_id) return fail('machine_id required')
  if (!Array.isArray(logs) || logs.length === 0) return ok({ ok: true, inserted: 0 })

  const sql = getDb()
  const batch = logs.slice(0, MAX_BATCH)

  for (const entry of batch) {
    const level = LEVELS.includes(entry.level ?? '') ? entry.level : 'info'
    const message = (entry.message ?? '').slice(0, 4000)
    if (!message) continue
    await sql`
      INSERT INTO remote_logs (machine_id, level, category, message, meta, pos_created_at)
      VALUES (
        ${machine_id}, ${level}, ${entry.category ?? null}, ${message},
        ${entry.meta ? JSON.stringify(entry.meta) : null},
        ${entry.created_at ?? null}
      )
    `
  }

  // Inline retention cleanup — avoids needing a cron job on Vercel.
  // Runs on ~2% of batches so it costs almost nothing.
  if (Math.random() < 0.02) {
    await sql`DELETE FROM remote_logs WHERE created_at < NOW() - (${RETENTION_DAYS} || ' days')::interval`
  }

  return ok({ ok: true, inserted: batch.length })
}
