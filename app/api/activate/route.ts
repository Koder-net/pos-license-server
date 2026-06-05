import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function computeExpiresAt(type: string): Date | null {
  if (type === 'yearly')  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  if (type === 'monthly') return new Date(Date.now() +  30 * 24 * 60 * 60 * 1000)
  return null
}

export async function POST(req: NextRequest) {
  let key: string, machine_id: string
  try {
    ;({ key, machine_id } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS })
  }

  if (!key || !machine_id) {
    return NextResponse.json({ error: 'key and machine_id are required' }, { status: 400, headers: CORS })
  }

  const sql = getDb()
  const rows = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Invalid license key' }, { status: 404, headers: CORS })
  }

  const license = rows[0]

  if (!license.is_active) {
    return NextResponse.json({ error: 'This license key has been deactivated' }, { status: 403, headers: CORS })
  }

  // Reinstall on same machine — return existing expiry
  if (license.machine_id === machine_id) {
    return NextResponse.json({
      success: true,
      message: 'Already activated on this machine',
      type: license.type,
      expires_at: license.expires_at ?? null,
    }, { headers: CORS })
  }

  // Already bound to a different machine
  if (license.machine_id && license.machine_id !== machine_id) {
    return NextResponse.json(
      { error: 'This key is already activated on another computer. Please purchase a new license.' },
      { status: 409, headers: CORS }
    )
  }

  // First activation
  const expires_at = computeExpiresAt(license.type)

  await sql`
    UPDATE licenses
    SET machine_id = ${machine_id}, activated_at = NOW(), expires_at = ${expires_at}
    WHERE key = ${key}
  `

  // Link this machine's installation record to the license
  await sql`
    UPDATE installations SET license_key = ${key} WHERE machine_id = ${machine_id}
  `

  return NextResponse.json({
    success: true,
    message: 'License activated successfully',
    type: license.type,
    expires_at: expires_at?.toISOString() ?? null,
  }, { headers: CORS })
}
