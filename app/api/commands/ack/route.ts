import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { ok, fail, preflight } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

/** POS confirms it executed a command (or reports why it couldn't). */
export async function POST(req: NextRequest) {
  let body: { machine_id?: string; command_id?: number; success?: boolean; result?: string }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid body')
  }

  const { machine_id, command_id, success, result } = body
  if (!machine_id || !command_id) return fail('machine_id and command_id required')

  const sql = getDb()
  await sql`
    UPDATE commands
    SET status   = ${success === false ? 'failed' : 'acked'},
        result   = ${result ?? null},
        acked_at = NOW()
    WHERE id = ${command_id} AND machine_id = ${machine_id}
  `

  return ok({ ok: true })
}
