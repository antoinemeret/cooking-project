import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { aggregateIngredients, calculateGroceryStats } from '@/lib/grocery-utils'

// Schema for validating request bodies
const UpdateGroceryItemSchema = z.object({
  userId: z.string(),
  ingredientName: z.string(),
  checked: z.boolean()
})

const GetGroceryListSchema = z.object({
  userId: z.string()
})

// GET /api/groceries - Generate grocery list from current meal plan
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Get current active meal plan with recipes
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      },
      include: {
        plannedRecipes: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                rawIngredients: true
              }
            }
          }
        }
      }
    })

    if (!mealPlan) {
      return NextResponse.json({
        groceryList: [],
        stats: {
          total: 0,
          checked: 0,
          remaining: 0,
          percentComplete: 0
        }
      })
    }

    // Get or create grocery list record
    let groceryListRecord = await prisma.groceryList.findFirst({
      where: {
        mealPlanId: mealPlan.id
      }
    })

    // Extract recipes with ingredients
    const recipes = mealPlan.plannedRecipes.map(pr => ({
      title: pr.recipe.title,
      rawIngredients: pr.recipe.rawIngredients
    }))

    // Generate aggregated ingredients
    let groceryList = aggregateIngredients(recipes)

    // If we have a saved grocery list, merge the checked states
    if (groceryListRecord && groceryListRecord.checkedItems) {
      try {
        const checkedItems = JSON.parse(groceryListRecord.checkedItems) as string[]
        groceryList = groceryList.map(item => ({
          ...item,
          checked: checkedItems.includes(item.name)
        }))
      } catch (error) {
        console.error('Error parsing checked items:', error)
      }
    }

    // If no grocery list record exists, create one
    if (!groceryListRecord) {
      const ingredientsJson = JSON.stringify(groceryList.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        sources: item.sources
      })))

      groceryListRecord = await prisma.groceryList.create({
        data: {
          mealPlanId: mealPlan.id,
          ingredients: ingredientsJson,
          checkedItems: JSON.stringify([])
        }
      })
    }

    const stats = calculateGroceryStats(groceryList)

    return NextResponse.json({
      groceryList,
      stats
    })

  } catch (error) {
    console.error('Error generating grocery list:', error)
    return NextResponse.json(
      { error: 'Failed to generate grocery list' },
      { status: 500 }
    )
  }
}

// PATCH /api/groceries - Update grocery item checked status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ingredientName, checked } = UpdateGroceryItemSchema.parse(body)

    // Get current active meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      }
    })

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'No active meal plan found' },
        { status: 404 }
      )
    }

    // Get grocery list record
    let groceryListRecord = await prisma.groceryList.findFirst({
      where: {
        mealPlanId: mealPlan.id
      }
    })

    if (!groceryListRecord) {
      // Create new grocery list record
      groceryListRecord = await prisma.groceryList.create({
        data: {
          mealPlanId: mealPlan.id,
          ingredients: JSON.stringify([]),
          checkedItems: JSON.stringify([])
        }
      })
    }

    // Update checked items
    let checkedItems: string[] = []
    try {
      checkedItems = JSON.parse(groceryListRecord.checkedItems || '[]')
    } catch (error) {
      console.error('Error parsing checked items:', error)
      checkedItems = []
    }

    if (checked) {
      // Add to checked items if not already present
      if (!checkedItems.includes(ingredientName)) {
        checkedItems.push(ingredientName)
      }
    } else {
      // Remove from checked items
      checkedItems = checkedItems.filter(item => item !== ingredientName)
    }

    // Update database
    await prisma.groceryList.update({
      where: { id: groceryListRecord.id },
      data: {
        checkedItems: JSON.stringify(checkedItems)
      }
    })

    return NextResponse.json({
      success: true,
      message: checked ? 'Item marked as purchased' : 'Item marked as not purchased'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating grocery item:', error)
    return NextResponse.json(
      { error: 'Failed to update grocery item' },
      { status: 500 }
    )
  }
}

// DELETE /api/groceries - Clear all checked items
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Get current active meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      }
    })

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'No active meal plan found' },
        { status: 404 }
      )
    }

    // Clear checked items
    await prisma.groceryList.updateMany({
      where: {
        mealPlanId: mealPlan.id
      },
      data: {
        checkedItems: JSON.stringify([])
      }
    })

    return NextResponse.json({
      success: true,
      message: 'All items marked as not purchased'
    })

  } catch (error) {
    console.error('Error clearing grocery list:', error)
    return NextResponse.json(
      { error: 'Failed to clear grocery list' },
      { status: 500 }
    )
  }
} 