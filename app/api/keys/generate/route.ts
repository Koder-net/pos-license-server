import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { generateLicenseKey } from '@/lib/keygen'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { ok, fail, unauthorized, preflight, clientIp } from '@/lib/http'

const VALID_TYPES = ['lifetime', '1year', '6month']

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return unauthorized()

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
      return fail('Failed to generate unique key', 500)
    }
  }

  await logAdminAction(
    'license_generate',
    customer_name ?? null,
    { count: keys.length, type, keys },
    clientIp(req.headers)
  )

  return ok({ success: true, keys })
}
