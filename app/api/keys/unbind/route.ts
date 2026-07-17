import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

/**
 * Release a key from its machine so the customer can activate it on a new
 * computer (hardware replacement, reinstall on a rebuilt PC, etc.).
 * The key keeps its type, expiry and installment progress.
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
  if (!license.machine_id) return fail('License is not bound to any machine')

  const previousMachine = license.machine_id as string

  await sql`UPDATE licenses SET machine_id = NULL WHERE key = ${key}`
  await sql`UPDATE installations SET license_key = NULL WHERE machine_id = ${previousMachine}`

  await logAdminAction('license_unbind', key, { previous_machine_id: previousMachine }, clientIp(req.headers))

  return ok({
    success: true,
    message: 'License released. It can now be activated on a different machine.',
    previous_machine_id: previousMachine,
  })
}
