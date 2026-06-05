import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateLicenseKey } from '@/lib/keygen'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

const VALID_TYPES = ['lifetime', 'yearly', 'monthly']

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  let customer_name: string | undefined, notes: string | undefined,
    type = 'lifetime', count = 1

  try {
    const body = await req.json()
    customer_name = body.customer_name
    notes = body.notes
    type = VALID_TYPES.includes(body.type) ? body.type : 'lifetime'
    count = Math.min(Math.max(parseInt(body.count ?? '1', 10), 1), 50)
  } catch { /* use defaults */ }

  const sql = getDb()
  const keys: string[] = []

  for (let i = 0; i < count; i++) {
    let key = generateLicenseKey()
    let inserted = false
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await sql`
          INSERT INTO licenses (key, type, customer_name, notes)
          VALUES (${key}, ${type}, ${customer_name ?? null}, ${notes ?? null})
        `
        keys.push(key)
        inserted = true
        break
      } catch { key = generateLicenseKey() }
    }
    if (!inserted) {
      return NextResponse.json({ error: 'Failed to generate unique key' }, { status: 500, headers: CORS })
    }
  }

  return NextResponse.json({ success: true, keys }, { headers: CORS })
}
