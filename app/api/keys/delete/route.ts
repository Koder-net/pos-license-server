import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

/**
 * Permanently remove a key. Only ever-unactivated keys can be deleted —
 * an activated key is a sales record, and deleting it would silently break
 * the customer's running install. Deactivate those instead.
 */
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

  if (license.machine_id || license.activated_at) {
    return fail(
      'This key has been activated and cannot be deleted. Deactivate it instead to preserve the record.',
      409
    )
  }

  await sql`DELETE FROM licenses WHERE key = ${key}`
  await logAdminAction('license_delete', key, { type: license.type }, clientIp(req.headers))

  return ok({ success: true, message: 'Unused key deleted' })
}
