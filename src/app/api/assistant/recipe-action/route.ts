import { NextRequest, NextResponse } from 'next/server'
import { mealPlanningChain } from '@/lib/conversation-chain'
import { conversationMemory } from '@/lib/conversation-memory'
import { checkAIApiRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rate-limiter'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * Handle recipe accept/decline actions and undo functionality
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Recipe action POST called')

    // Extract client IP for rate limiting
    const clientIP = getClientIP({
      headers: Object.fromEntries(request.headers.entries())
    })
    
    console.log('Client IP extracted:', clientIP)
    
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

    console.log('Rate limit check passed')

    // Parse request body
    const body = await request.json()
    const { 
      sessionId, 
      recipeId, 
      action, // 'accept', 'decline', or 'undo'
      reason, // optional reason for decline
      userId = 'anonymous'
    } = body

    console.log('Request body parsed:', { sessionId, recipeId, action, userId })

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!action || !['accept', 'decline', 'undo'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "accept", "decline", or "undo"' },
        { status: 400 }
      )
    }

    // For undo action, recipeId is not required
    if (action !== 'undo') {
      if (!recipeId || (typeof recipeId !== 'string' && typeof recipeId !== 'number')) {
        return NextResponse.json(
          { error: 'Recipe ID is required for accept/decline actions' },
          { status: 400 }
        )
      }
    }

    console.log('Validation passed')

    // Check if session exists
    const session = mealPlanningChain.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    console.log('Session found')

    // Handle undo action
    if (action === 'undo') {
      const undoResult = await mealPlanningChain.undoLastAction(sessionId)
      
      return NextResponse.json({
        success: undoResult.success,
        action: 'undo',
        message: undoResult.message,
        undoneAction: undoResult.undoneAction
      }, {
        headers: getRateLimitHeaders(clientIP, 'ip')
      })
    }

    // Convert recipeId to number for database operations
    const recipeIdNum = typeof recipeId === 'string' ? parseInt(recipeId, 10) : recipeId
    if (isNaN(recipeIdNum)) {
      return NextResponse.json(
        { error: 'Invalid recipe ID' },
        { status: 400 }
      )
    }

    // Verify recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeIdNum },
      select: { id: true, title: true, summary: true }
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    console.log('Recipe found:', recipe.title)

    // Process the action using the conversation chain
    let aiResponse: string
    let suggestedRecipes: any[] = []
    
    if (action === 'accept') {
      aiResponse = await mealPlanningChain.acceptRecipe(sessionId, recipeIdNum)
      await handleRecipeAccept(sessionId, recipeIdNum, recipe, userId, prisma)
    } else {
      aiResponse = await mealPlanningChain.declineRecipe(sessionId, recipeIdNum, reason)
      // Note: New decline method doesn't return suggestions automatically
      // Suggestions would need to be generated separately if needed
      await handleRecipeDecline(sessionId, recipeIdNum, recipe, reason, userId)
    }

    console.log('Action processed, AI response:', aiResponse)
    if (suggestedRecipes.length > 0) {
      console.log('New suggestions generated:', suggestedRecipes.map(s => s.recipe.title))
    }

    // Record interaction in conversation memory
    conversationMemory.recordRecipeInteraction(
      sessionId,
      userId,
      recipeIdNum,
      action === 'accept' ? 'accepted' : 'declined',
      reason
    )

    console.log('Interaction recorded')

    return NextResponse.json({
      success: true,
      sessionId,
      action,
      recipe: {
        id: recipe.id,
        title: recipe.title
      },
      aiResponse,
      ...(suggestedRecipes.length > 0 ? { suggestedRecipes } : {})
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Recipe action API error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * Handle recipe acceptance - add to meal plan
 */
async function handleRecipeAccept(
  sessionId: string,
  recipeId: number,
  recipe: { id: number; title: string; summary: string },
  userId: string,
  prisma: any
) {
  try {
    console.log('Handling recipe accept for:', recipe.title)
    
    // Find or create active meal plan
    let mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: 'active'
      }
    })

    if (!mealPlan) {
      mealPlan = await prisma.mealPlan.create({
        data: {
          userId,
          status: 'active'
        }
      })
    }

    // Add recipe to meal plan if not already added
    const existingPlannedRecipe = await prisma.plannedRecipe.findFirst({
      where: {
        mealPlanId: mealPlan.id,
        recipeId
      }
    })

    if (!existingPlannedRecipe) {
      await prisma.plannedRecipe.create({
        data: {
          mealPlanId: mealPlan.id,
          recipeId,
          completed: false
        }
      })
    }

    console.log(`Recipe ${recipeId} accepted and added to meal plan ${mealPlan.id}`)
  } catch (error) {
    console.error('Error handling recipe acceptance:', error)
  }
}

/**
 * Handle recipe decline - just log for now
 */
async function handleRecipeDecline(
  sessionId: string,
  recipeId: number,
  recipe: { id: number; title: string; summary: string },
  reason: string | undefined,
  userId: string
) {
  // Log the decline for analytics
  console.log(`Recipe ${recipeId} declined${reason ? ` (reason: ${reason})` : ''}`)
}

/**
 * Get current meal plan status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Recipe action GET called')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'anonymous'
    const sessionId = searchParams.get('sessionId')

    // Get active meal plan
    const mealPlan = await (prisma as any).mealPlan.findFirst({
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
                summary: true,
                time: true,
                grade: true
              }
            }
          },
          orderBy: {
            addedAt: 'desc'
          }
        }
      }
    })

    // Get session stats if sessionId provided
    let sessionStats = null
    if (sessionId) {
      sessionStats = conversationMemory.getSessionStats(sessionId)
    }

    return NextResponse.json({
      success: true,
      mealPlan: mealPlan ? {
        id: mealPlan.id,
        status: mealPlan.status,
        createdAt: mealPlan.createdAt,
        updatedAt: mealPlan.updatedAt,
        plannedRecipes: mealPlan.plannedRecipes.map((pr: any) => ({
          id: pr.id,
          completed: pr.completed,
          addedAt: pr.addedAt,
          recipe: pr.recipe
        }))
      } : null,
      sessionStats
    })

  } catch (error) {
    console.error('Meal plan retrieval error:', error)
    return NextResponse.json(
      { error: `Failed to retrieve meal plan: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}