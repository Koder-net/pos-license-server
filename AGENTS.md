<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Differences in this version (Next.js 16) that have already bitten, as a head start:

- **`middleware.ts` is now `proxy.ts`** (root-level, exports `proxy`). There is no
  `middleware.md` in the bundled docs — see
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Route handler `params` is a `Promise`** — `await ctx.params`. The global
  `RouteContext<'/path'>` helper only resolves once types are generated (`next dev` /
  `next build` / `next typegen`), so it fails on a brand-new route; a plain
  `{ params: Promise<{...}> }` annotation always works.
- **`cookies()` is async** — `await cookies()`.

# Project

Admin panel + license server for KodernetPOS. **Read `README.md`** for the architecture,
routes, API surface, and the remote-control design.

## Gotchas that cause runtime bugs

- **Neon returns `NUMERIC` as a string**, not a number, to preserve precision. Any numeric
  column feeding the UI must be cast (`col::float AS col`) or arithmetic and `.toFixed()`
  blow up at render time. Typecheck will NOT catch this — the TS interfaces say `number`.
- **`proxy.ts` is not the security boundary.** It only redirects browsers. Every
  `/api/admin/*` route must call `isAuthorized()` (`lib/auth.ts`) itself. POS-facing
  endpoints (`/api/register`, `/api/heartbeat`, `/api/logs`, `/api/validate`,
  `/api/activate`, `/api/commands/ack`) must stay unauthenticated — don't add them to the
  proxy matcher.
- **`/api/setup` is the migration.** It's idempotent (`CREATE TABLE IF NOT EXISTS` + guarded
  `ALTER`s). Add new tables/columns there, and run it after deploying.
- Heartbeat upserts `COALESCE` health/stats fields so a client-side probe failure (null)
  preserves the last known value; a real `0` still overwrites. Don't switch these back to
  bare `EXCLUDED.x` — it silently wipes good data.
- **Telemetry ingest must never gate command delivery.** In `/api/heartbeat`, ingest runs
  inside a `try/catch` and command delivery comes after it. This is not defensive padding:
  unexpected client data once threw mid-ingest and aborted the request before delivery, so
  every remote command sat `pending` forever while the panel still showed the device online
  and healthy — each `sql` call auto-commits separately, so `last_seen` kept updating.
- **POS row ids are TEXT, not INT.** The POS declares `users.id`/`branches.id` as
  `INTEGER PRIMARY KEY`, but SQLite is dynamically typed and real installs store **UUID
  strings** there. `pos_users.pos_user_id` / `pos_branches.pos_branch_id` are `VARCHAR(64)`;
  normalise with `rowId()` and cast prunes with `::text[]`. Never narrow these back to INT.
- **`NOT (x = ANY('{}'))` is TRUE for every row.** Any prune driven by a client-supplied id
  list must be skipped when that list is empty, or it wipes all of that machine's rows.
