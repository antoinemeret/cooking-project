import { NextRequest, NextResponse } from 'next/server'
import { checkAIApiRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rate-limiter'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * Generate or update grocery list from meal plan
 */
export async function POST(request: NextRequest) {
  try {
    // Extract client IP for rate limiting
    const clientIP = getClientIP({
      headers: Object.fromEntries(request.headers.entries())
    })
    
    // Check rate limits
    const rateLimitCheck = await checkAIApiRateLimit(clientIP, 'ip')
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.error },
        { 
          status: 429,
          headers: getRateLimitHeaders(clientIP, 'ip')
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { userId = 'anonymous', regenerate = false } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get active meal plan with recipes
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      },
      include: {
        plannedRecipes: {
          where: {
            completed: false // Only include recipes not yet cooked
          },
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                rawIngredients: true,
                ingredients: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        groceryList: true
      }
    })

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'No active meal plan found' },
        { status: 404 }
      )
    }

    if (mealPlan.plannedRecipes.length === 0) {
      return NextResponse.json(
        { error: 'No recipes in meal plan to generate grocery list' },
        { status: 400 }
      )
    }

    // Generate ingredients list from recipes
    const ingredients = await generateIngredientsFromRecipes(mealPlan.plannedRecipes)

    // Create or update grocery list
    let groceryList
    if (mealPlan.groceryList && !regenerate) {
      // Update existing grocery list
      groceryList = await prisma.groceryList.update({
        where: { id: mealPlan.groceryList.id },
        data: {
          ingredients: JSON.stringify(ingredients),
          updatedAt: new Date()
        }
      })
    } else {
      // Delete existing grocery list if regenerating
      if (mealPlan.groceryList && regenerate) {
        await prisma.groceryList.delete({
          where: { id: mealPlan.groceryList.id }
        })
      }

      // Create new grocery list
      groceryList = await prisma.groceryList.create({
        data: {
          mealPlanId: mealPlan.id,
          ingredients: JSON.stringify(ingredients),
          checkedItems: JSON.stringify([])
        }
      })
    }

    return NextResponse.json({
      success: true,
      groceryList: {
        id: groceryList.id,
        mealPlanId: groceryList.mealPlanId,
        ingredients: JSON.parse(groceryList.ingredients),
        checkedItems: JSON.parse(groceryList.checkedItems),
        createdAt: groceryList.createdAt,
        updatedAt: groceryList.updatedAt
      },
      recipeCount: mealPlan.plannedRecipes.length
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Grocery list generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get existing grocery list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'anonymous'

    // Get active meal plan with grocery list
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      },
      include: {
        groceryList: true,
        plannedRecipes: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    })

    if (!mealPlan) {
      return NextResponse.json({
        success: true,
        groceryList: null,
        mealPlan: null
      })
    }

    return NextResponse.json({
      success: true,
      groceryList: mealPlan.groceryList ? {
        id: mealPlan.groceryList.id,
        mealPlanId: mealPlan.groceryList.mealPlanId,
        ingredients: JSON.parse(mealPlan.groceryList.ingredients),
        checkedItems: JSON.parse(mealPlan.groceryList.checkedItems),
        createdAt: mealPlan.groceryList.createdAt,
        updatedAt: mealPlan.groceryList.updatedAt
      } : null,
      mealPlan: {
        id: mealPlan.id,
        recipeCount: mealPlan.plannedRecipes.length,
        recipes: mealPlan.plannedRecipes.map(pr => ({
          id: pr.recipe.id,
          title: pr.recipe.title,
          completed: pr.completed
        }))
      }
    })

  } catch (error) {
    console.error('Grocery list retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve grocery list' },
      { status: 500 }
    )
  }
}

/**
 * Update grocery list item checked status
 */
export async function PUT(request: NextRequest) {
  try {
    // Extract client IP for rate limiting
    const clientIP = getClientIP({
      headers: Object.fromEntries(request.headers.entries())
    })
    
    // Check rate limits
    const rateLimitCheck = await checkAIApiRateLimit(clientIP, 'ip')
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.error },
        { 
          status: 429,
          headers: getRateLimitHeaders(clientIP, 'ip')
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { groceryListId, itemName, checked } = body

    if (!groceryListId || typeof groceryListId !== 'number') {
      return NextResponse.json(
        { error: 'Grocery list ID is required' },
        { status: 400 }
      )
    }

    if (!itemName || typeof itemName !== 'string') {
      return NextResponse.json(
        { error: 'Item name is required' },
        { status: 400 }
      )
    }

    if (typeof checked !== 'boolean') {
      return NextResponse.json(
        { error: 'Checked status must be boolean' },
        { status: 400 }
      )
    }

    // Get existing grocery list
    const groceryList = await prisma.groceryList.findUnique({
      where: { id: groceryListId }
    })

    if (!groceryList) {
      return NextResponse.json(
        { error: 'Grocery list not found' },
        { status: 404 }
      )
    }

    // Update checked items
    const checkedItems = JSON.parse(groceryList.checkedItems) as string[]
    
    if (checked && !checkedItems.includes(itemName)) {
      checkedItems.push(itemName)
    } else if (!checked && checkedItems.includes(itemName)) {
      const index = checkedItems.indexOf(itemName)
      checkedItems.splice(index, 1)
    }

    // Update grocery list
    const updatedGroceryList = await prisma.groceryList.update({
      where: { id: groceryListId },
      data: {
        checkedItems: JSON.stringify(checkedItems),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      groceryList: {
        id: updatedGroceryList.id,
        mealPlanId: updatedGroceryList.mealPlanId,
        ingredients: JSON.parse(updatedGroceryList.ingredients),
        checkedItems: JSON.parse(updatedGroceryList.checkedItems),
        createdAt: updatedGroceryList.createdAt,
        updatedAt: updatedGroceryList.updatedAt
      }
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Grocery list update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate ingredients list from planned recipes
 */
async function generateIngredientsFromRecipes(
  plannedRecipes: Array<{
    recipe: {
      id: number
      title: string
      rawIngredients: string
      ingredients: Array<{ id: number; name: string }>
    }
  }>
): Promise<Array<{ name: string; source: string; recipes: string[] }>> {
  const ingredientsMap = new Map<string, { source: string; recipes: Set<string> }>()

  for (const plannedRecipe of plannedRecipes) {
    const recipe = plannedRecipe.recipe

    // Try to use normalized ingredients first
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      for (const ingredient of recipe.ingredients) {
        const key = ingredient.name.toLowerCase()
        if (!ingredientsMap.has(key)) {
          ingredientsMap.set(key, {
            source: 'normalized',
            recipes: new Set()
          })
        }
        ingredientsMap.get(key)!.recipes.add(recipe.title)
      }
    } else {
      // Fall back to raw ingredients parsing
      try {
        const rawIngredients = JSON.parse(recipe.rawIngredients) as string[]
        for (const rawIngredient of rawIngredients) {
          // Simple ingredient name extraction (remove quantities and common words)
          const cleanedName = cleanIngredientName(rawIngredient)
          if (cleanedName) {
            const key = cleanedName.toLowerCase()
            if (!ingredientsMap.has(key)) {
              ingredientsMap.set(key, {
                source: 'raw',
                recipes: new Set()
              })
            }
            ingredientsMap.get(key)!.recipes.add(recipe.title)
          }
        }
      } catch (error) {
        console.error(`Error parsing raw ingredients for recipe ${recipe.id}:`, error)
        // If JSON parsing fails, treat as plain text
        const lines = recipe.rawIngredients.split('\n').filter(line => line.trim())
        for (const line of lines) {
          const cleanedName = cleanIngredientName(line)
          if (cleanedName) {
            const key = cleanedName.toLowerCase()
            if (!ingredientsMap.has(key)) {
              ingredientsMap.set(key, {
                source: 'raw',
                recipes: new Set()
              })
            }
            ingredientsMap.get(key)!.recipes.add(recipe.title)
          }
        }
      }
    }
  }

  // Convert to array format
  return Array.from(ingredientsMap.entries()).map(([name, data]) => ({
    name: capitalizeFirst(name),
    source: data.source,
    recipes: Array.from(data.recipes)
  })).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Clean ingredient name by removing quantities and common cooking terms
 */
function cleanIngredientName(rawIngredient: string): string {
  let cleaned = rawIngredient.trim()
  
  // Remove common quantity patterns
  cleaned = cleaned.replace(/^\d+(\.\d+)?\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)\s*/i, '')
  cleaned = cleaned.replace(/^\d+(\.\d+)?\s*/i, '') // Remove standalone numbers
  cleaned = cleaned.replace(/^(a|an|the)\s+/i, '') // Remove articles
  
  // Remove common descriptors that don't affect shopping
  const descriptorsToRemove = [
    'fresh', 'dried', 'frozen', 'canned', 'chopped', 'diced', 'sliced',
    'minced', 'crushed', 'grated', 'shredded', 'cooked', 'raw',
    'large', 'medium', 'small', 'extra', 'to taste'
  ]
  
  for (const descriptor of descriptorsToRemove) {
    const regex = new RegExp(`\\b${descriptor}\\b`, 'gi')
    cleaned = cleaned.replace(regex, '').trim()
  }
  
  // Clean up extra spaces and punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/[,()]/g, '').trim()
  
  return cleaned || rawIngredient.trim() // Return original if cleaning resulted in empty string
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
} 