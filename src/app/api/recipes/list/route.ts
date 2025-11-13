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
    // Note: We overwrite ingredients with parsed rawIngredients for backwards compatibility
    // with RecipeSheet which expects ingredients to be string[] (not Ingredient[] objects)
    const recipesWithParsedIngredients = recipes.map(recipe => {
      let parsedRawIngredients: string[] = []
      try {
        parsedRawIngredients = recipe.rawIngredients ? JSON.parse(recipe.rawIngredients) : []
      } catch (err) {
        console.error(`Error parsing rawIngredients for recipe ${recipe.id}:`, err)
        parsedRawIngredients = []
      }
      
      return {
        ...recipe,
        // Overwrite ingredients with parsed rawIngredients for backwards compatibility
        // The actual Ingredient[] relation is still available but not in the response
        ingredients: parsedRawIngredients
      }
    })
    
    return NextResponse.json({ recipes: recipesWithParsedIngredients })
  } catch (err) {
    console.error('Error in /api/recipes/list:', err)
    return NextResponse.json({ 
      error: 'Server error', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 })
  }
} 