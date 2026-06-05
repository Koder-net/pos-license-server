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

  const installations = await sql`
    SELECT
      i.*,
      l.type        AS license_type,
      l.is_active   AS license_active,
      l.expires_at  AS license_expires_at,
      l.customer_name
    FROM installations i
    LEFT JOIN licenses l ON l.key = i.license_key
    ORDER BY i.last_seen_at DESC
  `

  return NextResponse.json({ installations }, { headers: CORS })
}
