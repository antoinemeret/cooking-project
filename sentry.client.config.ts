import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
  beforeSend(event, hint) {
    // Filter out development errors in production
    if (process.env.NODE_ENV === 'production' && event.exception) {
      const error = hint.originalException
      if (error instanceof Error) {
        // Filter out common development errors
        if (error.message.includes('ECONNREFUSED') || 
            error.message.includes('localhost') ||
            error.message.includes('127.0.0.1')) {
          return null
        }
      }
    }
    return event
  }
})


