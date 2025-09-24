import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET () {
  const startedAt = Date.now()
  try {
    // Lightweight connectivity check. Works across Postgres providers.
    // Using raw query avoids coupling to any specific model.
    const result = await prisma.$queryRaw`SELECT 1 as ok`
    const normalized = Array.isArray(result)
      ? result.map(row => Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])
        ))
      : result
    const durationMs = Date.now() - startedAt
    return NextResponse.json({ ok: true, result: normalized, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startedAt
    return NextResponse.json({ ok: false, error: String(err), durationMs }, { status: 500 })
  }
}


