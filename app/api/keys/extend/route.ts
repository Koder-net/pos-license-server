import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

const PLAN_TOTAL: Record<string, number> = { '6month': 6, '1year': 12 }

export async function OPTIONS() {
  return preflight()
}

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
  const rows = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`

  if (rows.length === 0) return fail('License not found', 404)

  const license = rows[0]

  if (!license.is_active) return fail('License is deactivated', 403)
  if (!license.machine_id) return fail('License has not been activated yet')

  const total = PLAN_TOTAL[license.type]
  if (!total) return fail('This license type does not use installments')

  const newPaid = (license.installments_paid ?? 0) + 1

  // All installments complete — upgrade to lifetime
  if (newPaid >= total) {
    await sql`
      UPDATE licenses
      SET type = 'lifetime', expires_at = NULL, installments_paid = ${newPaid}
      WHERE key = ${key}
    `
    await logAdminAction(
      'license_payment',
      key,
      { installment: newPaid, total, completed: true },
      clientIp(req.headers)
    )
    return ok({
      success: true,
      completed: true,
      message: `All ${total} installments paid. License upgraded to Lifetime.`,
      installments_paid: newPaid,
      total,
      type: 'lifetime',
      expires_at: null,
    })
  }

  // Extend expires_at by 30 days from now (or from current expiry if still in future)
  const base = license.expires_at && new Date(license.expires_at) > new Date()
    ? new Date(license.expires_at)
    : new Date()
  const new_expires_at = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

  await sql`
    UPDATE licenses
    SET expires_at = ${new_expires_at}, installments_paid = ${newPaid}
    WHERE key = ${key}
  `

  await logAdminAction(
    'license_payment',
    key,
    { installment: newPaid, total, completed: false },
    clientIp(req.headers)
  )

  return ok({
    success: true,
    completed: false,
    message: `Payment ${newPaid}/${total} recorded. Extended until ${new_expires_at.toISOString().split('T')[0]}.`,
    installments_paid: newPaid,
    total,
    type: license.type,
    expires_at: new_expires_at.toISOString(),
  })
}
