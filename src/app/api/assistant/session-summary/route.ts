import { NextRequest, NextResponse } from 'next/server'
import { mealPlanningChain } from '@/lib/conversation-chain'
import { checkAIApiRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

/**
 * Get session summary
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const summary = await mealPlanningChain.getSessionSummary(sessionId)

    return NextResponse.json({
      success: true,
      summary
    })

  } catch (error) {
    console.error('Session summary error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session summary' },
      { status: 500 }
    )
  }
}

/**
 * Finalize meal plan
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const result = await mealPlanningChain.finalizeMealPlan(sessionId)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      mealPlanId: result.mealPlanId
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Meal plan finalization error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize meal plan' },
      { status: 500 }
    )
  }
} 