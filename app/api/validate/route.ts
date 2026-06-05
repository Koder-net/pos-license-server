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

export async function POST(req: NextRequest) {
  let key: string, machine_id: string
  try {
    ;({ key, machine_id } = await req.json())
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' }, { status: 400, headers: CORS })
  }

  if (!key || !machine_id) {
    return NextResponse.json({ valid: false, error: 'key and machine_id are required' }, { status: 400, headers: CORS })
  }

  const sql = getDb()
  const rows = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`

  if (rows.length === 0) {
    return NextResponse.json({ valid: false, error: 'Invalid license key' }, { headers: CORS })
  }

  const license = rows[0]

  if (!license.is_active) {
    return NextResponse.json({ valid: false, error: 'License has been deactivated' }, { headers: CORS })
  }

  if (license.machine_id !== machine_id) {
    return NextResponse.json({ valid: false, error: 'License is registered to a different machine' }, { headers: CORS })
  }

  // Subscription expired
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return NextResponse.json({
      valid: false,
      expired: true,
      type: license.type,
      expires_at: license.expires_at,
    }, { headers: CORS })
  }

  return NextResponse.json({
    valid: true,
    type: license.type,
    expires_at: license.expires_at ?? null,
  }, { headers: CORS })
}
