import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = getDb()

  const [fleet] = await sql`
    SELECT
      COUNT(*)::int AS total_installs,
      COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '10 minutes')::int AS online_now,
      COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '48 hours')::int AS offline_48h,
      COUNT(*) FILTER (WHERE is_locked)::int AS locked_count
    FROM installations
  `

  const [licenses] = await sql`
    SELECT
      COUNT(*)::int AS total_keys,
      COUNT(*) FILTER (WHERE machine_id IS NOT NULL AND is_active AND (expires_at IS NULL OR expires_at > NOW()))::int AS active,
      COUNT(*) FILTER (WHERE machine_id IS NULL AND is_active)::int AS unused,
      COUNT(*) FILTER (WHERE is_active AND expires_at IS NOT NULL AND expires_at < NOW())::int AS expired,
      COUNT(*) FILTER (WHERE NOT is_active)::int AS deactivated
    FROM licenses
  `

  const [revenue] = await sql`
    SELECT
      COALESCE(SUM(revenue_today), 0)::float  AS fleet_revenue_today,
      COALESCE(SUM(revenue_total), 0)::float  AS fleet_revenue_total,
      COALESCE(SUM(sales_today), 0)::int      AS fleet_sales_today,
      COALESCE(SUM(db_size_mb), 0)::float     AS fleet_db_mb
    FROM installation_stats
  `

  // Licenses expiring in the next 7 days — the main "act now" list
  const expiringSoon = await sql`
    SELECT key, customer_name, type, expires_at, installments_paid
    FROM licenses
    WHERE is_active AND expires_at IS NOT NULL
      AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ORDER BY expires_at ASC
    LIMIT 10
  `

  const staleDevices = await sql`
    SELECT machine_id, hostname, nickname, last_seen_at, license_key
    FROM installations
    WHERE last_seen_at < NOW() - INTERVAL '48 hours'
    ORDER BY last_seen_at DESC
    LIMIT 10
  `

  const recentErrors = await sql`
    SELECT l.id, l.machine_id, l.level, l.category, l.message, l.created_at,
           i.hostname, i.nickname
    FROM remote_logs l
    LEFT JOIN installations i ON i.machine_id = l.machine_id
    WHERE l.level IN ('error', 'critical')
    ORDER BY l.created_at DESC
    LIMIT 10
  `

  // Fleet-wide revenue trend, last 30 days
  const revenueTrend = await sql`
    SELECT date::text AS date,
           SUM(revenue)::float   AS revenue,
           SUM(sales_count)::int AS sales
    FROM daily_stats
    WHERE date > CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date
    ORDER BY date ASC
  `

  const activationTrend = await sql`
    SELECT DATE(activated_at)::text AS date, COUNT(*)::int AS count
    FROM licenses
    WHERE activated_at > NOW() - INTERVAL '90 days'
    GROUP BY DATE(activated_at)
    ORDER BY date ASC
  `

  const versionSpread = await sql`
    SELECT COALESCE(app_version, 'unknown') AS version, COUNT(*)::int AS count
    FROM installations
    GROUP BY app_version
    ORDER BY count DESC
  `

  const recentActions = await sql`
    SELECT action, target, detail, created_at
    FROM admin_audit
    WHERE action <> 'login_failed'
    ORDER BY created_at DESC
    LIMIT 12
  `

  return NextResponse.json({
    fleet,
    licenses,
    revenue,
    expiringSoon,
    staleDevices,
    recentErrors,
    revenueTrend,
    activationTrend,
    versionSpread,
    recentActions,
  })
}
