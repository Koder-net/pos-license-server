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
  const result = await sql`
    UPDATE licenses SET is_active = FALSE WHERE key = ${key}
    RETURNING id
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404, headers: CORS })
  }

  return NextResponse.json({ success: true, message: 'License deactivated' }, { headers: CORS })
}
