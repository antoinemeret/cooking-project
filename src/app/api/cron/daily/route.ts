import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET () {
  const startedAt = Date.now()
  try {
    // Lightweight health check against DB; extend with cleanup if needed
    await prisma.$queryRaw`SELECT 1`
    const durationMs = Date.now() - startedAt
    return NextResponse.json({ ok: true, task: 'daily-health', durationMs })
  } catch (err) {
    const durationMs = Date.now() - startedAt
    return NextResponse.json({ ok: false, error: String(err), durationMs }, { status: 500 })
  }
}


