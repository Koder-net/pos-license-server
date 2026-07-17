import { NextResponse } from 'next/server'

/** CORS for POS-client-facing endpoints (Electron app, any origin). */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export function ok<T>(body: T, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: CORS })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS })
}

export function unauthorized() {
  return fail('Unauthorized', 401)
}

/** Extract the client's real IP from Vercel/proxy headers. */
export function clientIp(headers: Headers): string {
  return (
    (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
