import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { clientIp } from '@/lib/http'

export const COMMAND_TYPES = [
  'lock',
  'unlock',
  'message',
  'deactivate_license',
  'reset_trial',
  'extend_trial',
  'force_sync',
  'request_logs',
] as const

type CommandType = (typeof COMMAND_TYPES)[number]

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = getDb()
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  const commands = status
    ? await sql`
        SELECT c.*, i.hostname, i.nickname
        FROM commands c
        LEFT JOIN installations i ON i.machine_id = c.machine_id
        WHERE c.status = ${status}
        ORDER BY c.created_at DESC LIMIT ${limit}
      `
    : await sql`
        SELECT c.*, i.hostname, i.nickname
        FROM commands c
        LEFT JOIN installations i ON i.machine_id = c.machine_id
        ORDER BY c.created_at DESC LIMIT ${limit}
      `

  return NextResponse.json({ commands })
}

/**
 * Queue a command for one machine, a list of machines, or the whole fleet
 * (`machine_ids: "all"`). Lock/unlock also flip the installation flag right
 * away so the panel reflects intent even before the device next checks in.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { machine_ids?: string[] | 'all'; type?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { type, payload } = body
  if (!type || !COMMAND_TYPES.includes(type as CommandType)) {
    return NextResponse.json(
      { error: `type must be one of: ${COMMAND_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  if (type === 'message' && !(payload?.body as string)?.trim()) {
    return NextResponse.json({ error: 'message commands require a payload.body' }, { status: 400 })
  }
  if (type === 'extend_trial' && !Number.isFinite(Number(payload?.days))) {
    return NextResponse.json({ error: 'extend_trial requires payload.days' }, { status: 400 })
  }

  const sql = getDb()

  // Resolve targets
  let machineIds: string[]
  if (body.machine_ids === 'all') {
    const rows = await sql`SELECT machine_id FROM installations`
    machineIds = rows.map((r) => r.machine_id as string)
  } else if (Array.isArray(body.machine_ids) && body.machine_ids.length > 0) {
    machineIds = body.machine_ids
  } else {
    return NextResponse.json({ error: 'machine_ids required' }, { status: 400 })
  }

  const ip = clientIp(req.headers)
  const created: number[] = []

  for (const machineId of machineIds) {
    const [row] = await sql`
      INSERT INTO commands (machine_id, type, payload, created_by)
      VALUES (${machineId}, ${type}, ${payload ? JSON.stringify(payload) : null}, 'admin')
      RETURNING id
    `
    created.push(row.id as number)

    if (type === 'lock') {
      await sql`
        UPDATE installations
        SET is_locked = TRUE, lock_reason = ${(payload?.reason as string) ?? null}
        WHERE machine_id = ${machineId}
      `
    } else if (type === 'unlock') {
      await sql`
        UPDATE installations SET is_locked = FALSE, lock_reason = NULL
        WHERE machine_id = ${machineId}
      `
    } else if (type === 'deactivate_license') {
      await sql`
        UPDATE licenses SET is_active = FALSE
        WHERE key = (SELECT license_key FROM installations WHERE machine_id = ${machineId})
      `
    }
  }

  await logAdminAction(
    `command_${type}`,
    machineIds.length === 1 ? machineIds[0] : `${machineIds.length} devices`,
    { type, payload: payload ?? null, count: machineIds.length },
    ip
  )

  return NextResponse.json({ success: true, created, count: created.length })
}
