import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for validating request bodies
const UpdatePlannedRecipeSchema = z.object({
  plannedRecipeId: z.number(),
  completed: z.boolean().optional(),
  remove: z.boolean().optional()
})

const GetMealPlanSchema = z.object({
  userId: z.string()
})

const AddToPlannerSchema = z.object({
  recipeId: z.number(),
  userId: z.string()
})

// GET /api/planner - Get current meal plan for user
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

    // Get or create current active meal plan
    let mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      },
      include: {
        plannedRecipes: {
          include: {
            recipe: true
          },
          orderBy: {
            addedAt: 'desc'
          }
        }
      }
    })

    // If no active meal plan exists, create one
    if (!mealPlan) {
      mealPlan = await prisma.mealPlan.create({
        data: {
          userId,
          status: 'active'
        },
        include: {
          plannedRecipes: {
            include: {
              recipe: true
            },
            orderBy: {
              addedAt: 'desc'
            }
          }
        }
      })
    }

    return NextResponse.json({
      mealPlan,
      totalRecipes: mealPlan.plannedRecipes.length,
      completedRecipes: mealPlan.plannedRecipes.filter((pr: any) => pr.completed).length
    })

  } catch (error) {
    console.error('Error fetching meal plan:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meal plan' },
      { status: 500 }
    )
  }
}

// PATCH /api/planner - Update planned recipe (mark complete/incomplete or remove)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { plannedRecipeId, completed, remove } = UpdatePlannedRecipeSchema.parse(body)

    // If removing the recipe
    if (remove) {
      await prisma.plannedRecipe.delete({
        where: { id: plannedRecipeId }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Recipe removed from meal plan' 
      })
    }

    // If updating completion status
    if (completed !== undefined) {
      const updatedPlannedRecipe = await prisma.plannedRecipe.update({
        where: { id: plannedRecipeId },
        data: { completed },
        include: {
          recipe: true
        }
      })

      return NextResponse.json({ 
        success: true, 
        plannedRecipe: updatedPlannedRecipe,
        message: completed ? 'Recipe marked as completed' : 'Recipe marked as incomplete'
      })
    }

    return NextResponse.json(
      { error: 'No valid action specified' },
      { status: 400 }
    )

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating planned recipe:', error)
    return NextResponse.json(
      { error: 'Failed to update planned recipe' },
      { status: 500 }
    )
  }
}

// POST /api/planner - Add a recipe to the user's planner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipeId, userId = 'anonymous' } = body

    if (!recipeId || typeof recipeId !== 'number') {
      return NextResponse.json(
        { error: 'recipeId is required and must be a number' },
        { status: 400 }
      )
    }
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 }
      )
    }

    // Find or create active meal plan
    let mealPlan = await prisma.mealPlan.findFirst({
      where: { userId, status: 'active' }
    })
    if (!mealPlan) {
      mealPlan = await prisma.mealPlan.create({
        data: { userId, status: 'active' }
      })
    }

    // Check if recipe is already in the meal plan
    const existing = await prisma.plannedRecipe.findFirst({
      where: { mealPlanId: mealPlan.id, recipeId }
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Recipe already in planner', plannedRecipeId: existing.id },
        { status: 409 }
      )
    }

    // Add recipe to meal plan
    const plannedRecipe = await prisma.plannedRecipe.create({
      data: {
        mealPlanId: mealPlan.id,
        recipeId,
        completed: false
      }
    })

    return NextResponse.json({
      success: true,
      plannedRecipeId: plannedRecipe.id,
      message: 'Recipe added to planner'
    })
  } catch (error) {
    console.error('Error adding recipe to planner:', error)
    return NextResponse.json(
      { error: 'Failed to add recipe to planner' },
      { status: 500 }
    )
  }
}

// DELETE /api/planner - Clear entire meal plan
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

    // Find active meal plan
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

    // Delete all planned recipes for this meal plan
    await prisma.plannedRecipe.deleteMany({
      where: {
        mealPlanId: mealPlan.id
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Meal plan cleared' 
    })

  } catch (error) {
    console.error('Error clearing meal plan:', error)
    return NextResponse.json(
      { error: 'Failed to clear meal plan' },
      { status: 500 }
    )
  }
} 