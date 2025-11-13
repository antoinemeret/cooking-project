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
    console.log('[POST /api/planner] Request body:', body)
    
    let { recipeId, userId = 'anonymous' } = body

    // Convert recipeId to number if it's a string
    if (typeof recipeId === 'string') {
      recipeId = parseInt(recipeId, 10)
      console.log('[POST /api/planner] Converted recipeId from string to number:', recipeId)
    }

    if (!recipeId || typeof recipeId !== 'number' || isNaN(recipeId)) {
      console.error('[POST /api/planner] Invalid recipeId:', { recipeId, type: typeof recipeId, original: body.recipeId })
      return NextResponse.json(
        { error: `recipeId is required and must be a number. Received: ${body.recipeId} (type: ${typeof body.recipeId})` },
        { status: 400 }
      )
    }
    if (!userId || typeof userId !== 'string') {
      console.error('[POST /api/planner] Invalid userId:', userId)
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('[POST /api/planner] Validated input:', { recipeId, userId })

    // Verify that the recipe exists
    const recipeExists = await prisma.recipe.findUnique({
      where: { id: recipeId }
    })
    
    if (!recipeExists) {
      console.error('[POST /api/planner] Recipe not found:', recipeId)
      return NextResponse.json(
        { error: `Recipe with ID ${recipeId} not found` },
        { status: 404 }
      )
    }

    console.log('[POST /api/planner] Recipe exists:', recipeExists.title)

    // Find or create active meal plan
    let mealPlan = await prisma.mealPlan.findFirst({
      where: { userId, status: 'active' }
    })
    if (!mealPlan) {
      console.log('[POST /api/planner] Creating new meal plan for userId:', userId)
      mealPlan = await prisma.mealPlan.create({
        data: { userId, status: 'active' }
      })
    } else {
      console.log('[POST /api/planner] Found existing meal plan:', mealPlan.id)
    }

    // Check if recipe is already in the meal plan
    const existing = await prisma.plannedRecipe.findFirst({
      where: { mealPlanId: mealPlan.id, recipeId }
    })
    if (existing) {
      console.log('[POST /api/planner] Recipe already in planner:', existing.id)
      return NextResponse.json(
        { error: 'Recipe already in planner', plannedRecipeId: existing.id },
        { status: 409 }
      )
    }

    // Add recipe to meal plan
    console.log('[POST /api/planner] Creating plannedRecipe:', { mealPlanId: mealPlan.id, recipeId })
    
    let plannedRecipe
    try {
      plannedRecipe = await prisma.plannedRecipe.create({
        data: {
          mealPlanId: mealPlan.id,
          recipeId,
          completed: false
        }
      })
    } catch (createError: any) {
      // Check if error is due to unique constraint on id (sequence out of sync)
      const isUniqueConstraintOnId = 
        (createError?.code === 'P2002' && createError?.meta?.target?.includes('id')) ||
        (createError?.message?.includes('Unique constraint failed on the fields: (`id`)'))
      
      if (isUniqueConstraintOnId) {
        console.warn('[POST /api/planner] Sequence out of sync, resetting...', {
          errorCode: createError?.code,
          errorMessage: createError?.message
        })
        
        try {
          // Reset the sequence to the max ID + 1
          await prisma.$executeRawUnsafe(`
            SELECT setval(pg_get_serial_sequence('"PlannedRecipe"', 'id'), 
                          COALESCE((SELECT MAX(id) FROM "PlannedRecipe"), 0) + 1, 
                          false)
          `)
          
          console.log('[POST /api/planner] Sequence reset, retrying creation...')
          
          // Retry the creation
          plannedRecipe = await prisma.plannedRecipe.create({
            data: {
              mealPlanId: mealPlan.id,
              recipeId,
              completed: false
            }
          })
        } catch (retryError: any) {
          console.error('[POST /api/planner] Retry after sequence reset failed:', retryError)
          throw retryError
        }
      } else {
        // Re-throw if it's a different error
        throw createError
      }
    }

    console.log('[POST /api/planner] Successfully created plannedRecipe:', plannedRecipe.id)

    return NextResponse.json({
      success: true,
      plannedRecipeId: plannedRecipe.id,
      message: 'Recipe added to planner'
    })
  } catch (error) {
    console.error('[POST /api/planner] Error adding recipe to planner:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[POST /api/planner] Error details:', { errorMessage, errorStack })
    
    // Return more detailed error information in development
    return NextResponse.json(
      { 
        error: 'Failed to add recipe to planner',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
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