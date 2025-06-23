import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const recipes = await prisma.recipe.findMany({
      include: { ingredients: true }
    })
    return NextResponse.json({ recipes })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
} 