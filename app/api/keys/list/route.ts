import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { ok, unauthorized, preflight } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) return unauthorized()

  const sql = getDb()
  const licenses = await sql`
    SELECT l.id, l.key, l.machine_id, l.type, l.activated_at, l.expires_at, l.is_active,
           l.customer_name, l.notes, l.created_at, l.installments_paid,
           i.hostname, i.nickname, i.last_seen_at
    FROM licenses l
    LEFT JOIN installations i ON i.machine_id = l.machine_id
    ORDER BY l.created_at DESC
  `

  return ok({ licenses })
}
