import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'

/**
 * Global log explorer. All filters are optional and composed as SQL predicates
 * with `(${param} IS NULL OR <match>)` so the query stays a single prepared
 * statement — no string concatenation, no injection surface.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const machineId = searchParams.get('machine_id') || null
  const level = searchParams.get('level') || null
  const category = searchParams.get('category') || null
  const search = searchParams.get('search')?.trim() || null
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0)

  const sql = getDb()

  const logs = await sql`
    SELECT l.id, l.machine_id, l.level, l.category, l.message, l.meta,
           l.created_at, l.pos_created_at,
           i.hostname, i.nickname
    FROM remote_logs l
    LEFT JOIN installations i ON i.machine_id = l.machine_id
    WHERE (${machineId}::text IS NULL OR l.machine_id = ${machineId})
      AND (${level}::text      IS NULL OR l.level = ${level})
      AND (${category}::text   IS NULL OR l.category = ${category})
      AND (${search}::text     IS NULL OR l.message ILIKE '%' || ${search} || '%')
    ORDER BY l.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const [counts] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE level = 'critical')::int AS critical,
      COUNT(*) FILTER (WHERE level = 'error')::int    AS errors,
      COUNT(*) FILTER (WHERE level = 'warn')::int     AS warnings
    FROM remote_logs
    WHERE (${machineId}::text IS NULL OR machine_id = ${machineId})
      AND created_at > NOW() - INTERVAL '24 hours'
  `

  return NextResponse.json({ logs, counts })
}
