import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

/**
 * Redirects unauthenticated browsers away from admin pages toward /login.
 *
 * This is a UX convenience only — it is NOT the security boundary. Every
 * /api/admin/* route re-verifies auth via isAuthorized() in its own handler,
 * per the Next.js proxy docs' guidance not to rely on proxy alone.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authed = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!authed) {
    const url = new URL('/login', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Guard admin pages only. API routes authorize themselves; POS-facing
  // endpoints (/api/register, /api/heartbeat, ...) must stay open.
  matcher: [
    '/',
    '/login',
    '/installations/:path*',
    '/licenses/:path*',
    '/logs/:path*',
    '/commands/:path*',
  ],
}
