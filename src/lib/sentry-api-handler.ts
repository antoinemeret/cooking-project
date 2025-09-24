import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Wrapper for API route handlers to automatically capture errors with Sentry
 */
export function withSentryErrorHandling(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      console.error('Unhandled API error:', error)
      
      // Capture error with context
      Sentry.captureException(error, {
        tags: {
          api: 'unhandled-error',
          method: req.method,
          path: req.nextUrl.pathname
        },
        extra: {
          url: req.url,
          userAgent: req.headers.get('user-agent'),
          referer: req.headers.get('referer')
        }
      })

      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' 
            ? (error instanceof Error ? error.message : 'Unknown error')
            : 'Something went wrong'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Capture API errors with additional context
 */
export function captureApiError(
  error: unknown,
  context: {
    api: string
    method?: string
    path?: string
    userId?: string
    sessionId?: string
    [key: string]: any
  }
) {
  console.error(`API Error in ${context.api}:`, error)
  
  Sentry.captureException(error, {
    tags: {
      api: context.api,
      method: context.method,
      path: context.path
    },
    extra: {
      userId: context.userId,
      sessionId: context.sessionId,
      ...Object.fromEntries(
        Object.entries(context).filter(([key]) => 
          !['api', 'method', 'path', 'userId', 'sessionId'].includes(key)
        )
      )
    }
  })
}
