import { NextResponse, type NextRequest } from 'next/server'

// Simple in-memory rate limiter (per instance). Suitable for basic protection.
type Window = { count: number, resetAt: number }
const buckets: Record<string, Window> = {}

function getClientIp (req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0]?.trim() || req.ip || 'unknown'
}

function isAdminRequest (req: NextRequest): boolean {
  const url = new URL(req.url)
  const headerKey = req.headers.get('x-admin-key') || ''
  const queryKey = url.searchParams.get('key') || ''
  const envKey = process.env.NEXT_PUBLIC_ADMIN_KEY || process.env.ADMIN_KEY || ''
  if (!envKey) return false
  return headerKey === envKey || queryKey === envKey
}

function shouldRateLimit (pathname: string): { limit: number, windowMs: number } | null {
  // Tune limits per route group
  if (pathname.startsWith('/api/recipes/import-photo')) return { limit: 10, windowMs: 60_000 }
  if (pathname.startsWith('/api/recipes/import-video')) return { limit: 5, windowMs: 60 * 60_000 }
  if (pathname.startsWith('/api/scrape')) return { limit: 30, windowMs: 10 * 60_000 }
  if (pathname.startsWith('/api/')) return { limit: 120, windowMs: 60_000 }
  return null
}

export function middleware (req: NextRequest) {
  const { pathname } = new URL(req.url)

  // Protect admin routes with shared key (production only)
  if (process.env.NODE_ENV === 'production') {
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (!isAdminRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  // Skip rate limiting for dev convenience
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()

  const policy = shouldRateLimit(pathname)
  if (!policy) return NextResponse.next()

  const ip = getClientIp(req)
  const key = `${ip}:${policy.windowMs}:${policy.limit}:${pathname.split('/', 4).slice(0, 4).join('/')}`
  const now = Date.now()
  const bucket = buckets[key]

  if (!bucket || now > bucket.resetAt) {
    buckets[key] = { count: 1, resetAt: now + policy.windowMs }
    return NextResponse.next()
  }

  if (bucket.count < policy.limit) {
    bucket.count++
    return NextResponse.next()
  }

  const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))
  const res = NextResponse.json({ error: 'Rate limit exceeded', retryAfterSeconds: retryAfter }, { status: 429 })
  res.headers.set('Retry-After', String(retryAfter))
  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*'
  ]
}


