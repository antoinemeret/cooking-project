import { NextRequest, NextResponse } from 'next/server'
import { mealPlanningChain } from '@/lib/conversation-chain'
import { conversationMemory } from '@/lib/conversation-memory'
import { checkAIApiRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rate-limiter'
import { globalSessionStore } from '@/lib/session-store'

export const runtime = 'nodejs'

/**
 * Handle chat conversations with the recipe assistant
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
    const { 
      sessionId, 
      userInput, 
      userId = 'anonymous',
      streaming = true 
    } = body

    // Validate required fields
    if (!userInput || typeof userInput !== 'string') {
      return NextResponse.json(
        { error: 'User input is required' },
        { status: 400 }
      )
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Handle streaming response
    if (streaming) {
      return handleStreamingResponse(sessionId, userInput, userId, clientIP)
    }

    // Handle non-streaming response
    return handleStandardResponse(sessionId, userInput, userId, clientIP)

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle streaming chat response
 */
async function handleStreamingResponse(
  sessionId: string,
  userInput: string,
  userId: string,
  clientIP: string
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initialize session if needed
        let session = mealPlanningChain.getSession(sessionId)
        if (!session) {
          const errorData = JSON.stringify({
            type: 'error',
            error: 'Session not found. Please refresh and start a new conversation.'
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
          return
        }

        // Update conversation memory
        conversationMemory.updateConversationContext(
          sessionId,
          { role: 'user', content: userInput, timestamp: new Date() }
        )

        // Process streaming response
        const responseGenerator = mealPlanningChain.processUserInputStreaming(
          sessionId,
          userInput
        )

        let fullResponse = ''
        let usedFallback = false
        let serviceError = null

        for await (const chunk of responseGenerator) {
          fullResponse += chunk.content
          
          // Track if we're using fallback responses
          if (chunk.usedFallback) {
            usedFallback = true
          }
          
          if (chunk.error) {
            serviceError = chunk.error
          }
          
          // Send chunk to client
          const data = JSON.stringify({
            type: 'chunk',
            content: chunk.content,
            sessionId,
            usedFallback: chunk.usedFallback,
            error: chunk.error
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        // Send completion signal
        const completionData = JSON.stringify({
          type: 'complete',
          sessionId,
          fullResponse,
          usedFallback,
          serviceError
        })
        controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))

        controller.close()

      } catch (error) {
        console.error('Streaming error:', error)
        const errorData = JSON.stringify({
          type: 'error',
          error: 'Failed to process request',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...getRateLimitHeaders(clientIP, 'ip')
    }
  })
}

/**
 * Handle standard (non-streaming) chat response
 */
async function handleStandardResponse(
  sessionId: string,
  userInput: string,
  userId: string,
  clientIP: string
) {
  try {
    // Initialize session if needed
    let session = mealPlanningChain.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found. Please refresh and start a new conversation.' },
        { status: 404 }
      )
    }

    // Update conversation memory
    conversationMemory.updateConversationContext(
      sessionId,
      { role: 'user', content: userInput, timestamp: new Date() }
    )

    // Process user input
    const result = await mealPlanningChain.processUserInput(sessionId, userInput)

    // Get session stats for debugging
    const sessionStats = conversationMemory.getSessionStats(sessionId)

    return NextResponse.json({
      success: true,
      sessionId,
      response: result.response,
      suggestedRecipes: result.suggestedRecipes,
      usedFallback: result.usedFallback,
      serviceError: result.error,
      sessionStats
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Standard response error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: getRateLimitHeaders(clientIP, 'ip')
      }
    )
  }
}

/**
 * Start a new conversation session or resume existing one
 */
export async function PUT(request: NextRequest) {
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
    const { userId = 'anonymous', sessionId: preferredSessionId, forceNew = false } = body

    if (forceNew) {
      // Force start a new conversation
      const sessionId = await mealPlanningChain.startConversation(userId)
      conversationMemory.initializeSession(sessionId, userId)

      const session = mealPlanningChain.getSession(sessionId)
      const welcomeMessage = session?.messages[0]?.content || 'Welcome! How can I help you plan your meals?'

      return NextResponse.json({
        success: true,
        sessionId,
        welcomeMessage,
        isResumed: false
      }, {
        headers: getRateLimitHeaders(clientIP, 'ip')
      })
    }

    // Try to resume or start new conversation
    const result = await mealPlanningChain.resumeOrStartConversation(userId, preferredSessionId)
    
    // Initialize memory for new sessions
    if (!result.isResumed) {
      conversationMemory.initializeSession(result.sessionId, userId)
    }

    return NextResponse.json({
      success: true,
      ...result
    }, {
      headers: getRateLimitHeaders(clientIP, 'ip')
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create or resume session' },
      { status: 500 }
    )
  }
}

/**
 * Get session information and timeout status
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

    const session = mealPlanningChain.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    const sessionStats = conversationMemory.getSessionStats(sessionId)
    const metadata = globalSessionStore.getSessionMetadata(sessionId)
    const timeoutInfo = globalSessionStore.getSessionTimeoutInfo(sessionId)

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        userId: session.userId,
        messagesCount: session.messages.length,
        acceptedRecipes: session.acceptedRecipes,
        declinedRecipes: session.declinedRecipes,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      },
      metadata: metadata ? {
        status: metadata.status,
        isActive: metadata.isActive,
        lastActivity: metadata.lastActivity,
        messageCount: metadata.messageCount,
        acceptedRecipesCount: metadata.acceptedRecipesCount
      } : null,
      timeout: timeoutInfo,
      stats: sessionStats
    })

  } catch (error) {
    console.error('Session retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    )
  }
} 