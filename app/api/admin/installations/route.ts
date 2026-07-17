import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = getDb()

  // NUMERIC columns are cast to float: the Neon driver returns raw NUMERIC as a
  // *string* to preserve precision, which breaks arithmetic and .toFixed() in
  // the UI. Casting here keeps the JSON matching the client's number types.
  const installations = await sql`
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
      l.customer_name,
      l.installments_paid,
      s.db_size_mb::float    AS db_size_mb,
      s.disk_free_gb::float  AS disk_free_gb,
      s.disk_total_gb::float AS disk_total_gb,
      s.sales_today,
      s.revenue_today::float AS revenue_today,
      s.revenue_total::float AS revenue_total,
      s.pos_user_count,
      s.branch_count,
      s.last_backup_at,
      (SELECT COUNT(*)::int FROM commands c
        WHERE c.machine_id = i.machine_id AND c.status = 'pending') AS pending_commands
    FROM installations i
    LEFT JOIN licenses l           ON l.key = i.license_key
    LEFT JOIN installation_stats s ON s.machine_id = i.machine_id
    ORDER BY i.last_seen_at DESC
  `

  return NextResponse.json({ installations })
}
