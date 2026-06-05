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

  const sql = getDb()

  // Licenses table
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id            SERIAL PRIMARY KEY,
      key           VARCHAR(50)  UNIQUE NOT NULL,
      machine_id    VARCHAR(255),
      type          VARCHAR(20)  NOT NULL DEFAULT 'lifetime',
      activated_at  TIMESTAMPTZ,
      expires_at    TIMESTAMPTZ,
      is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
      customer_name VARCHAR(255),
      notes         TEXT,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `

  // Migrate existing licenses table (add new columns if missing)
  await sql`
    DO $$ BEGIN
      BEGIN ALTER TABLE licenses ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'lifetime'; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE licenses ADD COLUMN expires_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$
  `

  // Installations table — one row per machine, upserted on every startup
  await sql`
    CREATE TABLE IF NOT EXISTS installations (
      id               SERIAL PRIMARY KEY,
      machine_id       VARCHAR(255) UNIQUE NOT NULL,
      hostname         VARCHAR(255),
      cpu_model        VARCHAR(255),
      platform         VARCHAR(50),
      os_version       VARCHAR(100),
      arch             VARCHAR(20),
      total_ram_gb     NUMERIC(5,1),
      app_version      VARCHAR(20),
      ip_address       VARCHAR(50),
      country          VARCHAR(100),
      city             VARCHAR(100),
      trial_started_at TIMESTAMPTZ,
      last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      license_key      VARCHAR(50),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  return NextResponse.json({ success: true, message: 'Tables ready' }, { headers: CORS })
}
