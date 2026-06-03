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
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  const sql = getDb()

  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id          SERIAL PRIMARY KEY,
      key         VARCHAR(50)  UNIQUE NOT NULL,
      machine_id  VARCHAR(255),
      activated_at TIMESTAMPTZ,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      customer_name VARCHAR(255),
      notes       TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `

  return NextResponse.json({ success: true, message: 'Table created (or already exists)' }, { headers: CORS })
}
