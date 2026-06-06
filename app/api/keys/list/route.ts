import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
  }

  const sql = getDb()
  const licenses = await sql`
    SELECT id, key, machine_id, type, activated_at, expires_at, is_active,
           customer_name, notes, created_at, installments_paid
    FROM licenses
    ORDER BY created_at DESC
  `

  return NextResponse.json({ licenses }, { headers: CORS })
}
