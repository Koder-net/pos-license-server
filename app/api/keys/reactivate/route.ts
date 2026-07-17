import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

/** Reverse a deactivation (e.g. a payment dispute that got resolved). */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return unauthorized()

  let key: string
  try {
    ;({ key } = await req.json())
  } catch {
    return fail('Invalid request body')
  }

  if (!key) return fail('key is required')

  const sql = getDb()
  const [license] = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`
  if (!license) return fail('License not found', 404)
  if (license.is_active) return fail('License is already active')

  await sql`UPDATE licenses SET is_active = TRUE WHERE key = ${key}`
  await logAdminAction('license_reactivate', key, null, clientIp(req.headers))

  return ok({ success: true, message: 'License reactivated' })
}
