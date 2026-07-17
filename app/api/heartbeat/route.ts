import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { ok, fail, preflight, clientIp } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

interface PosUser {
  id?: number
  username?: string
  name?: string
  role?: string
  active?: boolean | number
  last_login_at?: string | null
}

interface PosBranch {
  id?: number
  name?: string
  address?: string
  phone?: string
  is_default?: boolean | number
  active?: boolean | number
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

const bool = (v: unknown): boolean => v === true || v === 1 || v === '1'

/**
 * Heartbeat — called by the POS on startup and every 5 minutes.
 *
 * Ingests health/storage/users/branches/sales telemetry, then returns any
 * pending remote commands. This piggyback is what makes remote control work
 * without websockets (Vercel serverless has no persistent connections).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Invalid body')
  }

  const machine_id = body.machine_id as string
  if (!machine_id) return fail('machine_id required')

  const sql = getDb()
  const ip = clientIp(req.headers)

  const health = (body.health ?? {}) as Record<string, unknown>
  const stats = (body.stats ?? {}) as Record<string, unknown>
  const users = Array.isArray(body.users) ? (body.users as PosUser[]) : []
  const branches = Array.isArray(body.branches) ? (body.branches as PosBranch[]) : []
  const daily = Array.isArray(body.daily) ? (body.daily as Record<string, unknown>[]) : []

  // ── Touch the installation row (keeps last_seen fresh even between /register calls)
  await sql`
    UPDATE installations
    SET last_seen_at      = NOW(),
        last_heartbeat_at = NOW(),
        ip_address        = ${ip},
        app_version       = COALESCE(${(health.app_version as string) ?? null}, app_version)
    WHERE machine_id = ${machine_id}
  `

  // ── Health / storage / sales snapshot
  await sql`
    INSERT INTO installation_stats (
      machine_id, db_size_mb, disk_free_gb, disk_total_gb, ram_used_gb,
      uptime_seconds, app_version, last_backup_at,
      sales_today, revenue_today, sales_total, revenue_total,
      pos_user_count, branch_count, product_count, customer_count, updated_at
    ) VALUES (
      ${machine_id}, ${num(health.db_size_mb)}, ${num(health.disk_free_gb)},
      ${num(health.disk_total_gb)}, ${num(health.ram_used_gb)},
      ${num(health.uptime_seconds)}, ${(health.app_version as string) ?? null},
      ${(health.last_backup_at as string) ?? null},
      ${num(stats.sales_today)}, ${num(stats.revenue_today)},
      ${num(stats.sales_total)}, ${num(stats.revenue_total)},
      ${users.length}, ${branches.length},
      ${num(stats.product_count)}, ${num(stats.customer_count)},
      NOW()
    )
    ON CONFLICT (machine_id) DO UPDATE SET
      -- Health probes are best-effort (statfs/stat can fail on a locked-down
      -- box). COALESCE so a transient null never erases a known-good reading.
      db_size_mb     = COALESCE(EXCLUDED.db_size_mb, installation_stats.db_size_mb),
      disk_free_gb   = COALESCE(EXCLUDED.disk_free_gb, installation_stats.disk_free_gb),
      disk_total_gb  = COALESCE(EXCLUDED.disk_total_gb, installation_stats.disk_total_gb),
      ram_used_gb    = COALESCE(EXCLUDED.ram_used_gb, installation_stats.ram_used_gb),
      uptime_seconds = COALESCE(EXCLUDED.uptime_seconds, installation_stats.uptime_seconds),
      app_version    = COALESCE(EXCLUDED.app_version, installation_stats.app_version),
      last_backup_at = COALESCE(EXCLUDED.last_backup_at, installation_stats.last_backup_at),
      -- A real 0 (no sales yet today) still overwrites; only an *absent*
      -- reading arrives as null and preserves the previous value.
      sales_today    = COALESCE(EXCLUDED.sales_today, installation_stats.sales_today),
      revenue_today  = COALESCE(EXCLUDED.revenue_today, installation_stats.revenue_today),
      sales_total    = COALESCE(EXCLUDED.sales_total, installation_stats.sales_total),
      revenue_total  = COALESCE(EXCLUDED.revenue_total, installation_stats.revenue_total),
      pos_user_count = EXCLUDED.pos_user_count,
      branch_count   = EXCLUDED.branch_count,
      product_count  = COALESCE(EXCLUDED.product_count, installation_stats.product_count),
      customer_count = COALESCE(EXCLUDED.customer_count, installation_stats.customer_count),
      updated_at     = NOW()
  `

  // ── POS users (upsert; stale rows for deleted users are pruned below)
  for (const u of users) {
    await sql`
      INSERT INTO pos_users (machine_id, pos_user_id, username, name, role, active, last_login_at, synced_at)
      VALUES (${machine_id}, ${u.id ?? null}, ${u.username ?? null}, ${u.name ?? null},
              ${u.role ?? null}, ${bool(u.active)}, ${u.last_login_at ?? null}, NOW())
      ON CONFLICT (machine_id, pos_user_id) DO UPDATE SET
        username      = EXCLUDED.username,
        name          = EXCLUDED.name,
        role          = EXCLUDED.role,
        active        = EXCLUDED.active,
        last_login_at = COALESCE(EXCLUDED.last_login_at, pos_users.last_login_at),
        synced_at     = NOW()
    `
  }
  if (users.length > 0) {
    // Drop users that no longer exist on the client
    const keep = users.map((u) => u.id).filter((id): id is number => typeof id === 'number')
    await sql`
      DELETE FROM pos_users
      WHERE machine_id = ${machine_id} AND NOT (pos_user_id = ANY(${keep}::int[]))
    `
  }

  // ── Branches
  for (const b of branches) {
    await sql`
      INSERT INTO pos_branches (machine_id, pos_branch_id, name, address, phone, is_default, active, synced_at)
      VALUES (${machine_id}, ${b.id ?? null}, ${b.name ?? null}, ${b.address ?? null},
              ${b.phone ?? null}, ${bool(b.is_default)}, ${bool(b.active)}, NOW())
      ON CONFLICT (machine_id, pos_branch_id) DO UPDATE SET
        name       = EXCLUDED.name,
        address    = EXCLUDED.address,
        phone      = EXCLUDED.phone,
        is_default = EXCLUDED.is_default,
        active     = EXCLUDED.active,
        synced_at  = NOW()
    `
  }
  if (branches.length > 0) {
    const keep = branches.map((b) => b.id).filter((id): id is number => typeof id === 'number')
    await sql`
      DELETE FROM pos_branches
      WHERE machine_id = ${machine_id} AND NOT (pos_branch_id = ANY(${keep}::int[]))
    `
  }

  // ── Daily sales rollup (client sends a trailing window, e.g. last 14 days)
  for (const d of daily) {
    const date = d.date as string
    if (!date) continue
    await sql`
      INSERT INTO daily_stats (machine_id, date, sales_count, revenue, updated_at)
      VALUES (${machine_id}, ${date}, ${num(d.sales_count) ?? 0}, ${num(d.revenue) ?? 0}, NOW())
      ON CONFLICT (machine_id, date) DO UPDATE SET
        sales_count = EXCLUDED.sales_count,
        revenue     = EXCLUDED.revenue,
        updated_at  = NOW()
    `
  }

  // ── Pending commands → deliver
  const commands = await sql`
    SELECT id, type, payload FROM commands
    WHERE machine_id = ${machine_id} AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 20
  `
  if (commands.length > 0) {
    const ids = commands.map((c) => c.id as number)
    await sql`
      UPDATE commands SET status = 'delivered', delivered_at = NOW()
      WHERE id = ANY(${ids}::int[])
    `
  }

  const lockRows = await sql`
    SELECT is_locked, lock_reason FROM installations WHERE machine_id = ${machine_id} LIMIT 1
  `

  return ok({
    ok: true,
    locked: lockRows[0]?.is_locked ?? false,
    lock_reason: lockRows[0]?.lock_reason ?? null,
    commands,
  })
}
