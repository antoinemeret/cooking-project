import { NextRequest, NextResponse } from 'next/server'
import { mealPlanningChain } from '@/lib/conversation-chain'
import { conversationMemory } from '@/lib/conversation-memory'
import { checkAIApiRateLimit, getRateLimitHeaders, getClientIP } from '@/lib/rate-limiter'
import { globalSessionStore } from '@/lib/session-store'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'

/**
 * Handle chat conversations with the recipe assistant
 */
export async function POST(request: NextRequest) {
  // Hoist variables for Sentry context in catch
  let sessionId: string | undefined
  let userId: string = 'anonymous'
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
    const parsed = body as any
    sessionId = parsed?.sessionId
    userId = parsed?.userId ?? 'anonymous'
    const userInput = parsed?.userInput
    const streaming = parsed?.streaming ?? true

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
      const safeSessionId = sessionId as string
      const safeUserInput = userInput as string
      const safeUserId = userId as string
      return handleStreamingResponse(safeSessionId, safeUserInput, safeUserId, clientIP)
    }

    // Handle non-streaming response
    {
      const safeSessionId = sessionId as string
      const safeUserInput = userInput as string
      const safeUserId = userId as string
      return handleStandardResponse(safeSessionId, safeUserInput, safeUserId, clientIP)
    }

  } catch (error) {
    console.error('Chat API error:', error)
    Sentry.captureException(error, {
      tags: { api: 'assistant-chat' },
      extra: { sessionId, userId }
    })
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
        Sentry.captureException(error, {
          tags: { api: 'assistant-chat-streaming' },
          extra: { sessionId, userId }
        })
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
    Sentry.captureException(error, {
      tags: { api: 'assistant-chat-standard' },
      extra: { sessionId, userId }
    })
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
  // Hoist variables for Sentry context in catch
  let userId: string = 'anonymous'
  let preferredSessionId: string | undefined
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
    userId = body?.userId ?? 'anonymous'
    preferredSessionId = body?.sessionId
    const forceNew: boolean = body?.forceNew ?? false

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
    Sentry.captureException(error, {
      tags: { api: 'assistant-chat-session' },
      extra: { userId, preferredSessionId }
    })
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
  // Hoist variable for Sentry context in catch
  let sessionId: string | null = null
  try {
    const { searchParams } = new URL(request.url)
    sessionId = searchParams.get('sessionId')

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
    Sentry.captureException(error, {
      tags: { api: 'assistant-chat-get-session' },
      extra: { sessionId }
    })
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    )
  }
} 