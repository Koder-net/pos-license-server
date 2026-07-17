import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  isValidAdminSecret,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { clientIp } from '@/lib/http'

export async function POST(req: NextRequest) {
  let secret: string | undefined
  try {
    ;({ secret } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const ip = clientIp(req.headers)

  if (!isValidAdminSecret(secret)) {
    await logAdminAction('login_failed', null, null, ip)
    return NextResponse.json({ error: 'Incorrect admin secret' }, { status: 401 })
  }

  const { token, expiresAt } = createSessionToken()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt })

  await logAdminAction('login', null, null, ip)
  return NextResponse.json({ success: true })
}
