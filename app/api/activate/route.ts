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

  // Already activated on this exact machine — allow reinstalls
  if (license.machine_id === machine_id) {
    return NextResponse.json({ success: true, message: 'Already activated on this machine' }, { headers: CORS })
  }

  // Already activated on a different machine
  if (license.machine_id && license.machine_id !== machine_id) {
    return NextResponse.json(
      { error: 'This key is already activated on another computer. Please purchase a new license.' },
      { status: 409, headers: CORS }
    )
  }

  // First activation — bind the key to this machine
  await sql`
    UPDATE licenses
    SET machine_id = ${machine_id}, activated_at = NOW()
    WHERE key = ${key}
  `

  return NextResponse.json({ success: true, message: 'License activated successfully' }, { headers: CORS })
}
