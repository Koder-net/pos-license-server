import { getDb } from '@/lib/db'

/** Record an admin mutation. Never throws — auditing must not break the action. */
export async function logAdminAction(
  action: string,
  target: string | null,
  detail: Record<string, unknown> | null,
  ip?: string
): Promise<void> {
  try {
    const sql = getDb()
    await sql`
      INSERT INTO admin_audit (action, target, detail, ip_address)
      VALUES (${action}, ${target}, ${detail ? JSON.stringify(detail) : null}, ${ip ?? null})
    `
  } catch (e) {
    console.error('[audit] failed to record action:', action, e)
  }
}
