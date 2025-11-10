import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const ingredients = await prisma.ingredient.findMany({
      select: {
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    
    const ingredientNames = ingredients.map(ingredient => ingredient.name)
    
    return NextResponse.json({ ingredients: ingredientNames })
  } catch (err) {
    console.error('Error fetching ingredients:', err)
    return NextResponse.json({ 
      error: 'Server error', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 })
  }
}
