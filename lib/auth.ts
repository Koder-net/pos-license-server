import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function adminSecret(): string {
  const secret = process.env.ADMIN_SECRET
  if (!secret) throw new Error('ADMIN_SECRET environment variable is not set')
  return secret
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function sign(payload: string): string {
  return createHmac('sha256', adminSecret()).update(payload).digest('hex')
}

/** Stateless session token: "<expiresAtMs>.<hmac>" — no session table needed. */
export function createSessionToken(): { token: string; expiresAt: Date } {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = String(expiresAt)
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt) }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  if (!safeEqual(signature, sign(payload))) return false
  const expiresAt = Number(payload)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export function isValidAdminSecret(candidate: string | undefined | null): boolean {
  if (!candidate) return false
  return safeEqual(candidate, adminSecret())
}

/**
 * Authorize an admin request. Accepts either a session cookie (browser panel)
 * or the legacy `x-admin-secret` header (scripts / existing integrations).
 *
 * Every admin route calls this directly — proxy.ts is a convenience redirect
 * layer, not the security boundary (see Next.js proxy docs: always verify auth
 * inside the handler).
 */
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (isValidAdminSecret(req.headers.get('x-admin-secret'))) return true
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}
