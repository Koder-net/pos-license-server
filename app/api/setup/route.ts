import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAuthorized } from '@/lib/auth'
import { ok, unauthorized, preflight } from '@/lib/http'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return unauthorized()

  const sql = getDb()

  // ─── Licenses ───────────────────────────────────────────────────────────────
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

  await sql`
    DO $$ BEGIN
      BEGIN ALTER TABLE licenses ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'lifetime'; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE licenses ADD COLUMN expires_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE licenses ADD COLUMN installments_paid INT NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$
  `

  // ─── Installations ──────────────────────────────────────────────────────────
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

  // Remote-control + labelling columns
  await sql`
    DO $$ BEGIN
      BEGIN ALTER TABLE installations ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE installations ADD COLUMN lock_reason TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE installations ADD COLUMN nickname VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE installations ADD COLUMN last_heartbeat_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$
  `

  // ─── Per-installation health / storage snapshot (one row per machine) ───────
  await sql`
    CREATE TABLE IF NOT EXISTS installation_stats (
      machine_id      VARCHAR(255) PRIMARY KEY,
      db_size_mb      NUMERIC(10,2),
      disk_free_gb    NUMERIC(10,2),
      disk_total_gb   NUMERIC(10,2),
      ram_used_gb     NUMERIC(10,2),
      uptime_seconds  BIGINT,
      app_version     VARCHAR(20),
      last_backup_at  TIMESTAMPTZ,
      sales_today     INT     DEFAULT 0,
      revenue_today   NUMERIC(14,2) DEFAULT 0,
      sales_total     INT     DEFAULT 0,
      revenue_total   NUMERIC(14,2) DEFAULT 0,
      pos_user_count  INT     DEFAULT 0,
      branch_count    INT     DEFAULT 0,
      product_count   INT     DEFAULT 0,
      customer_count  INT     DEFAULT 0,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // ─── POS user accounts registered inside each installation ──────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pos_users (
      id             SERIAL PRIMARY KEY,
      machine_id     VARCHAR(255) NOT NULL,
      pos_user_id    INT,
      username       VARCHAR(255),
      name           VARCHAR(255),
      role           VARCHAR(50),
      active         BOOLEAN DEFAULT TRUE,
      last_login_at  TIMESTAMPTZ,
      synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (machine_id, pos_user_id)
    )
  `

  // ─── Branches configured inside each installation ───────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pos_branches (
      id            SERIAL PRIMARY KEY,
      machine_id    VARCHAR(255) NOT NULL,
      pos_branch_id INT,
      name          VARCHAR(255),
      address       TEXT,
      phone         VARCHAR(50),
      is_default    BOOLEAN DEFAULT FALSE,
      active        BOOLEAN DEFAULT TRUE,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (machine_id, pos_branch_id)
    )
  `

  // ─── Daily sales rollup per installation (powers fleet charts) ──────────────
  await sql`
    CREATE TABLE IF NOT EXISTS daily_stats (
      machine_id   VARCHAR(255) NOT NULL,
      date         DATE NOT NULL,
      sales_count  INT DEFAULT 0,
      revenue      NUMERIC(14,2) DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (machine_id, date)
    )
  `

  // ─── Live log stream ────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS remote_logs (
      id             BIGSERIAL PRIMARY KEY,
      machine_id     VARCHAR(255) NOT NULL,
      level          VARCHAR(20)  NOT NULL DEFAULT 'info',
      category       VARCHAR(50),
      message        TEXT         NOT NULL,
      meta           JSONB,
      pos_created_at TIMESTAMPTZ,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_remote_logs_machine ON remote_logs (machine_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_remote_logs_level   ON remote_logs (level, created_at DESC)`

  // ─── Remote commands queue ──────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS commands (
      id           SERIAL PRIMARY KEY,
      machine_id   VARCHAR(255) NOT NULL,
      type         VARCHAR(50)  NOT NULL,
      payload      JSONB,
      status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
      result       TEXT,
      created_by   VARCHAR(100),
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMPTZ,
      acked_at     TIMESTAMPTZ
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_commands_pending ON commands (machine_id, status)`

  // ─── Admin action audit trail ───────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit (
      id         BIGSERIAL PRIMARY KEY,
      action     VARCHAR(100) NOT NULL,
      target     VARCHAR(255),
      detail     JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at DESC)`

  return ok({ success: true, message: 'Tables ready' })
}
