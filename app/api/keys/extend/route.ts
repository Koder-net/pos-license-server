import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

const PLAN_TOTAL: Record<string, number> = { '6month': 6, '1year': 12 }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  let key: string
  try {
    ;({ key } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS })
  }

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400, headers: CORS })
  }

  const sql = getDb()
  const rows = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`

  if (rows.length === 0) {
    return NextResponse.json({ error: 'License not found' }, { status: 404, headers: CORS })
  }

  const license = rows[0]

  if (!license.is_active) {
    return NextResponse.json({ error: 'License is deactivated' }, { status: 403, headers: CORS })
  }

  if (!license.machine_id) {
    return NextResponse.json({ error: 'License has not been activated yet' }, { status: 400, headers: CORS })
  }

  const total = PLAN_TOTAL[license.type]
  if (!total) {
    return NextResponse.json({ error: 'This license type does not use installments' }, { status: 400, headers: CORS })
  }

  const newPaid = (license.installments_paid ?? 0) + 1

  // All installments complete — upgrade to lifetime
  if (newPaid >= total) {
    await sql`
      UPDATE licenses
      SET type = 'lifetime', expires_at = NULL, installments_paid = ${newPaid}
      WHERE key = ${key}
    `
    return NextResponse.json({
      success: true,
      completed: true,
      message: `All ${total} installments paid. License upgraded to Lifetime.`,
      installments_paid: newPaid,
      total,
      type: 'lifetime',
      expires_at: null,
    }, { headers: CORS })
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

  return NextResponse.json({
    success: true,
    completed: false,
    message: `Payment ${newPaid}/${total} recorded. Extended until ${new_expires_at.toISOString().split('T')[0]}.`,
    installments_paid: newPaid,
    total,
    type: license.type,
    expires_at: new_expires_at.toISOString(),
  }, { headers: CORS })
}
