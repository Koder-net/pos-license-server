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
  let key: string, machine_id: string, legacy_machine_id: string | undefined
  try {
    ;({ key, machine_id, legacy_machine_id } = await req.json())
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
    // The client's machine fingerprint changed (e.g. it was upgraded from the
    // old MAC-address-based fingerprint to a stable OS-level ID). If the
    // license is still bound to the previous fingerprint this app instance
    // reports, it's the same physical machine — rebind transparently instead
    // of locking the user out.
    if (legacy_machine_id && license.machine_id === legacy_machine_id) {
      await sql`UPDATE licenses SET machine_id = ${machine_id} WHERE key = ${key} AND machine_id = ${legacy_machine_id}`
      license.machine_id = machine_id
    } else {
      return NextResponse.json({ valid: false, error: 'License is registered to a different machine' }, { headers: CORS })
    }
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

  // Remote kill-switch. Reported alongside a *valid* license so the client
  // keeps its key and simply shows the lock screen — unlocking restores the
  // app without the customer having to re-enter anything.
  const [inst] = await sql`
    SELECT is_locked, lock_reason FROM installations WHERE machine_id = ${machine_id} LIMIT 1
  `

  return NextResponse.json({
    valid: true,
    type: license.type,
    expires_at: license.expires_at ?? null,
    locked: inst?.is_locked ?? false,
    lock_reason: inst?.lock_reason ?? null,
  }, { headers: CORS })
}
