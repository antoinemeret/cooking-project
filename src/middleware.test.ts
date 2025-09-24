import { middleware } from './middleware'
import { NextRequest } from 'next/server'

function makeRequest (url: string, headers: Record<string,string> = {}): NextRequest {
  // @ts-expect-error minimal mock for tests
  return new NextRequest(url, { headers: new Headers(headers), method: 'GET' })
}

describe('middleware - admin protection', () => {
  const originalEnv = process.env.NODE_ENV
  const originalAdmin = process.env.NEXT_PUBLIC_ADMIN_KEY

  beforeAll(() => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_ADMIN_KEY = 'secret'
  })

  afterAll(() => {
    process.env.NODE_ENV = originalEnv
    process.env.NEXT_PUBLIC_ADMIN_KEY = originalAdmin
  })

  test('blocks admin path without key', async () => {
    const req = makeRequest('https://example.com/admin/import-comparison')
    const res = middleware(req)
    // @ts-expect-error internal
    expect(res.status).toBe(401)
  })

  test('allows admin path with matching key header', async () => {
    const req = makeRequest('https://example.com/admin/import-comparison', { 'x-admin-key': 'secret' })
    const res = middleware(req)
    // @ts-expect-error internal
    expect(res.status || 200).toBe(200)
  })
})

describe('middleware - rate limiting', () => {
  const originalEnv = process.env.NODE_ENV
  beforeAll(() => { process.env.NODE_ENV = 'production' })
  afterAll(() => { process.env.NODE_ENV = originalEnv })

  test('applies rate limit on generic api route', async () => {
    const url = 'https://example.com/api/test'
    let lastStatus = 200
    for (let i = 0; i < 130; i++) {
      const req = makeRequest(url, { 'x-forwarded-for': '1.2.3.4' })
      const res = middleware(req)
      // @ts-expect-error internal
      lastStatus = res.status || 200
      if (lastStatus === 429) break
    }
    expect(lastStatus).toBe(429)
  })
})


