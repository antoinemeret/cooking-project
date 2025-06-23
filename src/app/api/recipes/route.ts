import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, rawIngredients, instructions } = body

    if (!title || !Array.isArray(rawIngredients) || !instructions) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const recipe = await prisma.recipe.create({
      data: {
        title,
        summary: '', // Add summary if available
        instructions,
        rawIngredients: JSON.stringify(rawIngredients), // Store as JSON string
        startSeason: 1, // Set defaults or get from user/LLM
        endSeason: 12,
        grade: 0,
        time: 0
        // Do not connect ingredients here
      },
      include: { ingredients: true }
    })

    return NextResponse.json({ recipe })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}