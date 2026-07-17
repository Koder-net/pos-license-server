import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { clientIp } from '@/lib/http'

type Ctx = { params: Promise<{ machineId: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { machineId } = await ctx.params
  const sql = getDb()

  // NUMERIC → ::float so the client receives numbers, not precision-preserving
  // strings (which break arithmetic and .toFixed()).
  const [installation] = await sql`
    SELECT
      i.id, i.machine_id, i.hostname, i.nickname, i.cpu_model, i.platform,
      i.os_version, i.arch, i.app_version, i.ip_address, i.country, i.city,
      i.trial_started_at, i.last_seen_at, i.license_key, i.created_at,
      i.is_locked, i.lock_reason,
      i.total_ram_gb::float AS total_ram_gb,
      (i.last_seen_at > NOW() - INTERVAL '10 minutes') AS is_online,
      l.type       AS license_type,
      l.is_active  AS license_active,
      l.expires_at AS license_expires_at,
      l.activated_at AS license_activated_at,
      l.customer_name,
      l.notes      AS license_notes,
      l.installments_paid
    FROM installations i
    LEFT JOIN licenses l ON l.key = i.license_key
    WHERE i.machine_id = ${machineId}
    LIMIT 1
  `

  if (!installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 })
  }

  const [stats] = await sql`
    SELECT
      machine_id, uptime_seconds, app_version, last_backup_at,
      sales_today, sales_total, pos_user_count, branch_count,
      product_count, customer_count, updated_at,
      db_size_mb::float    AS db_size_mb,
      disk_free_gb::float  AS disk_free_gb,
      disk_total_gb::float AS disk_total_gb,
      ram_used_gb::float   AS ram_used_gb,
      revenue_today::float AS revenue_today,
      revenue_total::float AS revenue_total
    FROM installation_stats WHERE machine_id = ${machineId} LIMIT 1
  `

  const users = await sql`
    SELECT pos_user_id, username, name, role, active, last_login_at, synced_at
    FROM pos_users WHERE machine_id = ${machineId}
    ORDER BY role, name
  `

  const branches = await sql`
    SELECT pos_branch_id, name, address, phone, is_default, active
    FROM pos_branches WHERE machine_id = ${machineId}
    ORDER BY is_default DESC, name
  `

  const dailyStats = await sql`
    SELECT date::text AS date, sales_count, revenue::float AS revenue
    FROM daily_stats
    WHERE machine_id = ${machineId} AND date > CURRENT_DATE - INTERVAL '30 days'
    ORDER BY date ASC
  `

  const logs = await sql`
    SELECT id, level, category, message, meta, created_at, pos_created_at
    FROM remote_logs WHERE machine_id = ${machineId}
    ORDER BY created_at DESC
    LIMIT 100
  `

  const commands = await sql`
    SELECT id, type, payload, status, result, created_at, delivered_at, acked_at
    FROM commands WHERE machine_id = ${machineId}
    ORDER BY created_at DESC
    LIMIT 30
  `

  return NextResponse.json({
    installation,
    stats: stats ?? null,
    users,
    branches,
    dailyStats,
    logs,
    commands,
  })
}

/** Update admin-owned fields on an installation (currently: nickname). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { machineId } = await ctx.params

  let body: { nickname?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const sql = getDb()
  const nickname = body.nickname?.trim() || null

  await sql`UPDATE installations SET nickname = ${nickname} WHERE machine_id = ${machineId}`
  await logAdminAction('installation_rename', machineId, { nickname }, clientIp(req.headers))

  return NextResponse.json({ success: true })
}
