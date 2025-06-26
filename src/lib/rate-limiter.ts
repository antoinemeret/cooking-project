interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator?: (identifier: string) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * Simple in-memory rate limiter for AI API calls
 * In production, consider using Redis or a more robust solution
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * Check if a request is allowed for the given identifier
   */
  async isAllowed(identifier: string): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier
    const now = Date.now()
    
    let entry = this.store.get(key)
    
    // If no entry exists or the window has expired, create a new one
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      }
    }
    
    // Check if we've exceeded the limit
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        resetTime: entry.resetTime,
        remaining: 0
      }
    }
    
    // Increment the count and update the store
    entry.count++
    this.store.set(key, entry)
    
    return {
      allowed: true,
      resetTime: entry.resetTime,
      remaining: this.config.maxRequests - entry.count
    }
  }

  /**
   * Get current usage stats for an identifier
   */
  getUsage(identifier: string): { count: number; resetTime: number; remaining: number } | null {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier
    const entry = this.store.get(key)
    
    if (!entry || Date.now() >= entry.resetTime) {
      return null
    }
    
    return {
      count: entry.count,
      resetTime: entry.resetTime,
      remaining: this.config.maxRequests - entry.count
    }
  }

  /**
   * Reset the rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier
    this.store.delete(key)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

// Testing exceptions - users/IPs that get higher limits
const TESTING_EXCEPTIONS = {
  users: ['user123', 'test-user', 'antoine'], // Add your test user IDs here
  ips: ['127.0.0.1', '::1', 'localhost'], // Local development IPs
  limits: {
    maxRequests: 100, // 100 requests per hour for testing
    windowMs: 60 * 60 * 1000 // 1 hour
  }
}

// Rate limiter configurations
const AI_API_RATE_LIMITS = {
  // Per user limits
  user: {
    maxRequests: 50, // 50 requests per hour per user
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (userId: string) => `user:${userId}`
  },
  
  // Global limits (all users combined)
  global: {
    maxRequests: 500, // 500 requests per hour globally
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: () => 'global'
  },
  
  // Per IP limits (for unauthenticated users)
  ip: {
    maxRequests: 10, // 10 requests per hour per IP
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (ip: string) => `ip:${ip}`
  },
  
  // Testing limits (for whitelisted users/IPs)
  testing: TESTING_EXCEPTIONS.limits
}

// Create rate limiter instances
export const userRateLimiter = new RateLimiter(AI_API_RATE_LIMITS.user)
export const globalRateLimiter = new RateLimiter(AI_API_RATE_LIMITS.global)
export const ipRateLimiter = new RateLimiter(AI_API_RATE_LIMITS.ip)
export const testingRateLimiter = new RateLimiter(AI_API_RATE_LIMITS.testing)

/**
 * Check if a user/IP is in the testing exception list
 */
function isTestingException(identifier: string, type: 'user' | 'ip'): boolean {
  if (type === 'user') {
    return TESTING_EXCEPTIONS.users.includes(identifier)
  } else {
    return TESTING_EXCEPTIONS.ips.includes(identifier)
  }
}

/**
 * Check if an AI API request is allowed
 */
export async function checkAIApiRateLimit(
  identifier: string,
  type: 'user' | 'ip' = 'user'
): Promise<{ allowed: boolean; error?: string; resetTime?: number; remaining?: number }> {
  // Check if this is a testing exception
  const isTesting = isTestingException(identifier, type)
  
  // Check global rate limit first (skip for testing exceptions)
  if (!isTesting) {
    const globalCheck = await globalRateLimiter.isAllowed('global')
    if (!globalCheck.allowed) {
      return {
        allowed: false,
        error: 'Global rate limit exceeded. Please try again later.',
        resetTime: globalCheck.resetTime
      }
    }
  }

  // Choose the appropriate rate limiter
  let limiter: RateLimiter
  let maxRequests: number
  
  if (isTesting) {
    limiter = testingRateLimiter
    maxRequests = AI_API_RATE_LIMITS.testing.maxRequests
    console.log(`[TESTING] Using elevated rate limits for ${type}: ${identifier} (${maxRequests} requests/hour)`)
  } else {
    limiter = type === 'user' ? userRateLimiter : ipRateLimiter
    maxRequests = AI_API_RATE_LIMITS[type].maxRequests
  }
  
  const userCheck = await limiter.isAllowed(identifier)
  
  if (!userCheck.allowed) {
    const limitType = type === 'user' ? 'user' : 'IP address'
    return {
      allowed: false,
      error: `Rate limit exceeded for this ${limitType}. Please try again later.`,
      resetTime: userCheck.resetTime
    }
  }

  // For testing exceptions, only return user limits (no global limit consideration)
  if (isTesting) {
    return {
      allowed: true,
      remaining: userCheck.remaining,
      resetTime: userCheck.resetTime
    }
  }

  // For regular users, consider both global and user limits
  const globalCheck = await globalRateLimiter.isAllowed('global')
  return {
    allowed: true,
    remaining: Math.min(globalCheck.remaining || 0, userCheck.remaining || 0),
    resetTime: Math.max(globalCheck.resetTime || 0, userCheck.resetTime || 0)
  }
}

/**
 * Get rate limit headers for API responses
 */
export function getRateLimitHeaders(
  identifier: string,
  type: 'user' | 'ip' = 'user'
): Record<string, string> {
  const isTesting = isTestingException(identifier, type)
  
  let limiter: RateLimiter
  let maxRequests: number
  
  if (isTesting) {
    limiter = testingRateLimiter
    maxRequests = AI_API_RATE_LIMITS.testing.maxRequests
  } else {
    limiter = type === 'user' ? userRateLimiter : ipRateLimiter
    maxRequests = AI_API_RATE_LIMITS[type].maxRequests
  }
  
  const usage = limiter.getUsage(identifier)
  const globalUsage = isTesting ? null : globalRateLimiter.getUsage('global')
  
  if (!usage && !globalUsage) {
    return {}
  }
  
  let remaining: number
  let resetTime: number
  
  if (isTesting) {
    // For testing, only consider user limits
    remaining = usage?.remaining || maxRequests
    resetTime = usage?.resetTime || 0
  } else {
    // For regular users, consider both user and global limits
    remaining = Math.min(
      usage?.remaining || maxRequests,
      globalUsage?.remaining || AI_API_RATE_LIMITS.global.maxRequests
    )
    resetTime = Math.max(
      usage?.resetTime || 0,
      globalUsage?.resetTime || 0
    )
  }
  
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    ...(isTesting ? { 'X-RateLimit-Testing': 'true' } : {})
  }
}

/**
 * Middleware-style rate limit checker for Next.js API routes
 */
export async function withRateLimit<T>(
  req: { headers: { [key: string]: string | string[] | undefined } },
  identifier: string,
  type: 'user' | 'ip',
  handler: () => Promise<T>
): Promise<T> {
  const rateLimitCheck = await checkAIApiRateLimit(identifier, type)
  
  if (!rateLimitCheck.allowed) {
    const error = new Error(rateLimitCheck.error || 'Rate limit exceeded')
    ;(error as any).status = 429
    ;(error as any).resetTime = rateLimitCheck.resetTime
    throw error
  }
  
  return handler()
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(req: { headers: { [key: string]: string | string[] | undefined } }): string {
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP
  }
  
  return 'unknown'
} 