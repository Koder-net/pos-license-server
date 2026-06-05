import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function getGeoLocation(ip: string): Promise<{ country: string | null; city: string | null }> {
  const clean = ip.replace(/^::ffff:/, '') // strip IPv4-mapped IPv6 prefix
  if (!clean || clean === '127.0.0.1' || clean === '::1' || clean.startsWith('192.168') || clean.startsWith('10.')) {
    return { country: null, city: null }
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${clean}?fields=status,country,city`, {
      signal: AbortSignal.timeout(4000)
    })
    const data = await res.json()
    if (data.status === 'success') return { country: data.country, city: data.city }
  } catch {}
  return { country: null, city: null }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS })
  }

  const { machine_id, hostname, cpu_model, platform, os_version, arch, total_ram_gb, app_version, trial_started_at, license_key } = body as Record<string, string>

  if (!machine_id) {
    return NextResponse.json({ error: 'machine_id required' }, { status: 400, headers: CORS })
  }

  // Extract real IP from Vercel/proxy headers
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  const { country, city } = await getGeoLocation(ip)

  const sql = getDb()

  await sql`
    INSERT INTO installations (
      machine_id, hostname, cpu_model, platform, os_version, arch,
      total_ram_gb, app_version, ip_address, country, city,
      trial_started_at, last_seen_at, license_key
    )
    VALUES (
      ${machine_id}, ${hostname ?? null}, ${cpu_model ?? null},
      ${platform ?? null}, ${os_version ?? null}, ${arch ?? null},
      ${total_ram_gb ? parseFloat(total_ram_gb as unknown as string) : null},
      ${app_version ?? null}, ${ip}, ${country}, ${city},
      ${trial_started_at ?? null}, NOW(), ${license_key ?? null}
    )
    ON CONFLICT (machine_id) DO UPDATE SET
      hostname         = EXCLUDED.hostname,
      cpu_model        = EXCLUDED.cpu_model,
      platform         = EXCLUDED.platform,
      os_version       = EXCLUDED.os_version,
      arch             = EXCLUDED.arch,
      total_ram_gb     = EXCLUDED.total_ram_gb,
      app_version      = EXCLUDED.app_version,
      ip_address       = EXCLUDED.ip_address,
      country          = COALESCE(EXCLUDED.country, installations.country),
      city             = COALESCE(EXCLUDED.city, installations.city),
      trial_started_at = COALESCE(installations.trial_started_at, EXCLUDED.trial_started_at),
      last_seen_at     = NOW(),
      license_key      = EXCLUDED.license_key
  `

  return NextResponse.json({ ok: true }, { headers: CORS })
}
