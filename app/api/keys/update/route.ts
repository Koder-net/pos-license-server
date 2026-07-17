import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

const VALID_TYPES = ['lifetime', '1year', '6month']

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return unauthorized()

  let body: { key?: string; customer_name?: string; notes?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request body')
  }

  const { key } = body
  if (!key) return fail('key is required')
  if (body.type && !VALID_TYPES.includes(body.type)) {
    return fail(`type must be one of: ${VALID_TYPES.join(', ')}`)
  }

  const sql = getDb()
  const [existing] = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`
  if (!existing) return fail('License not found', 404)

  const customer_name = body.customer_name !== undefined ? body.customer_name || null : existing.customer_name
  const notes = body.notes !== undefined ? body.notes || null : existing.notes
  const type = body.type ?? existing.type

  // Switching an activated key to lifetime clears its expiry; switching away
  // from lifetime without a new expiry would strand it, so recompute a window.
  let expires_at = existing.expires_at
  if (type !== existing.type) {
    if (type === 'lifetime') {
      expires_at = null
    } else if (existing.activated_at) {
      expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  }

  await sql`
    UPDATE licenses
    SET customer_name = ${customer_name}, notes = ${notes},
        type = ${type}, expires_at = ${expires_at}
    WHERE key = ${key}
  `

  await logAdminAction('license_update', key, { customer_name, type }, clientIp(req.headers))
  return ok({ success: true })
}
