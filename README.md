# KodernetPOS — License Server & Central Admin Control Panel

Next.js 16 (App Router) + Neon Postgres, deployed on Vercel. It issues and validates
KodernetPOS licenses, ingests telemetry from every installation, and provides a central
admin panel with remote control over the fleet.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

Environment (`.env.local`):

| Variable       | Purpose                                                  |
|----------------|----------------------------------------------------------|
| `DATABASE_URL` | Neon Postgres connection string                          |
| `ADMIN_SECRET` | Admin panel password + legacy `x-admin-secret` API key   |

**After any deploy that changes the schema, run the migration** (idempotent — safe to
re-run; only adds missing tables/columns):

```bash
curl -X POST https://<your-host>/api/setup -H "x-admin-secret: $ADMIN_SECRET"
```

## Admin panel

Sign in at `/login` with `ADMIN_SECRET`. The session is a signed, httpOnly cookie (12h).

| Route                        | What it does                                                        |
|------------------------------|---------------------------------------------------------------------|
| `/`                          | Fleet dashboard — KPIs, revenue trend, versions, alerts, audit trail |
| `/installations`             | Every device: status, license, location, storage, users, revenue     |
| `/installations/[machineId]` | Per-device: overview, POS users, branches, sales, live logs, control |
| `/licenses`                  | Generate / edit / unbind / deactivate / reactivate / record payments |
| `/logs`                      | Fleet-wide log explorer with level + category filters                |
| `/commands`                  | Command history and fleet-wide broadcast                            |

## API

**POS-facing** (no auth, scoped by `machine_id`):

| Endpoint                 | Purpose                                                      |
|--------------------------|--------------------------------------------------------------|
| `POST /api/register`     | Upserts the installation record on startup                   |
| `POST /api/activate`     | Binds a license key to a machine                             |
| `POST /api/validate`     | Validates a key; also returns the remote `locked` flag       |
| `POST /api/heartbeat`    | Ingests telemetry **and returns pending commands** (5 min)   |
| `POST /api/logs`         | Batched log upload                                           |
| `POST /api/commands/ack` | POS confirms a command was executed                          |

**Admin-facing** (session cookie *or* `x-admin-secret` header): `/api/admin/*` and
`/api/keys/*`. Every admin route authorizes itself via `isAuthorized()` in `lib/auth.ts` —
`proxy.ts` only redirects browsers and is **not** the security boundary.

## Remote control

There are no websockets (Vercel is serverless). Commands are queued in the `commands`
table and delivered on the device's next heartbeat (≤5 min), then acked. Supported types:

`lock` · `unlock` · `message` · `deactivate_license` · `reset_trial` · `extend_trial` ·
`force_sync` · `request_logs`

Lock/unlock additionally flip `installations.is_locked`, which both `/api/heartbeat` and
`/api/validate` report. That flag — not the one-shot command — is the source of truth, so a
lock still applies if the device missed the command or was offline when it was issued.

## Conventions

- This is **Next.js 16**: `middleware.ts` is now `proxy.ts`, route `params` are a Promise,
  and `cookies()` is async. Read `node_modules/next/dist/docs/` before changing routing.
- **Neon returns `NUMERIC` as a string** to preserve precision. Always cast numeric columns
  with `::float` in queries that feed the UI, or arithmetic and `.toFixed()` break at runtime.
- Heartbeat upserts `COALESCE` health/stats fields, so a failed probe on the client sends
  `null` and preserves the last known value instead of wiping it. A real `0` still overwrites.
- Charts are single-series by design (`app/components/Chart.tsx`); dual-axis charts are not used.
- Admin mutations are recorded via `logAdminAction()` (`lib/audit.ts`).
