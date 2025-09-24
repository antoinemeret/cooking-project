import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const recipes = await prisma.recipe.findMany({
      include: { 
        ingredients: true 
      }
    })
    
    // Parse rawIngredients JSON string for each recipe
    const recipesWithParsedIngredients = recipes.map(recipe => ({
      ...recipe,
      ingredients: recipe.rawIngredients ? JSON.parse(recipe.rawIngredients) : []
    }))
    
    return NextResponse.json({ recipes: recipesWithParsedIngredients })
  } catch (err) {
    console.error('Error in /api/recipes/list:', err)
    return NextResponse.json({ 
      error: 'Server error', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 })
  }
} 