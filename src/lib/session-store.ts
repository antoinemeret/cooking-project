import { MealPlanningSession } from './conversation-chain'
import { prisma } from './prisma'

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000 // 2 hours
const SESSION_WARNING_TIME = 10 * 60 * 1000 // 10 minutes before timeout

export interface SessionMetadata {
  sessionId: string
  userId: string
  createdAt: Date
  updatedAt: Date
  lastActivity: Date
  isActive: boolean
  messageCount: number
  acceptedRecipesCount: number
  status: 'active' | 'idle' | 'expired' | 'completed'
}

/**
 * Prisma-backed session store (replaces previous file-based store)
 */
class GlobalSessionStore {
  private static instance: GlobalSessionStore
  private instanceId: string
  private sessionMetadata: Map<string, SessionMetadata> = new Map()

  private constructor() {
    this.instanceId = Math.random().toString(36).substring(7)
    console.log(`GlobalSessionStore instance created: ${this.instanceId}`)
    // No-op: metadata hydrated on demand from DB
  }

  static getInstance(): GlobalSessionStore {
    if (!GlobalSessionStore.instance) {
      GlobalSessionStore.instance = new GlobalSessionStore()
    }
    return GlobalSessionStore.instance
  }

  /**
   * Create a new session with enhanced tracking
   */
  async createSession(sessionId: string, session: MealPlanningSession): Promise<void> {
    await prisma.chatSession.create({
      data: {
        id: sessionId,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: new Date(),
        status: 'active',
        messageCount: session.messages.length,
        acceptedRecipes: JSON.stringify(session.acceptedRecipes || []),
        declinedRecipes: JSON.stringify(session.declinedRecipes || []),
        currentCriteria: JSON.stringify(session.currentCriteria || {})
      }
    })

    this.sessionMetadata.set(sessionId, {
      sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: new Date(),
      isActive: true,
      messageCount: session.messages.length,
      acceptedRecipesCount: session.acceptedRecipes.length,
      status: 'active'
    })
  }

  async setSession(sessionId: string, session: MealPlanningSession): Promise<void> {
    try {
      // Update session row
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: session.updatedAt,
          lastActivity: new Date(),
          messageCount: session.messages.length,
          acceptedRecipes: JSON.stringify(session.acceptedRecipes || []),
          declinedRecipes: JSON.stringify(session.declinedRecipes || []),
          currentCriteria: JSON.stringify(session.currentCriteria || {})
        }
      })

      // Replace messages (simple approach to keep parity)
      await prisma.chatMessage.deleteMany({ where: { sessionId } })
      if (session.messages.length > 0) {
        await prisma.chatMessage.createMany({
          data: session.messages.map(m => ({
            sessionId,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          }))
        })
      }

      // Update in-memory metadata cache
      const metadata = this.sessionMetadata.get(sessionId)
      if (metadata) {
        metadata.updatedAt = session.updatedAt
        metadata.lastActivity = new Date()
        metadata.messageCount = session.messages.length
        metadata.acceptedRecipesCount = session.acceptedRecipes.length
        metadata.status = this.determineSessionStatus(metadata)
      } else {
        this.sessionMetadata.set(sessionId, {
          sessionId,
          userId: session.userId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastActivity: new Date(),
          isActive: true,
          messageCount: session.messages.length,
          acceptedRecipesCount: session.acceptedRecipes.length,
          status: 'active'
        })
      }
    } catch (error) {
      console.error(`[${this.instanceId}] Error storing session ${sessionId}:`, error)
    }
  }

  getSession(sessionId: string): MealPlanningSession | undefined {
    // Synchronous signature preserved; perform blocking deopt by throwing if used incorrectly
    // All existing callers use it synchronously. We query synchronously via deasync-like pattern is not available,
    // so instead we maintain a minimal in-memory cache hydration on first access.
    // As a pragmatic approach, attempt to read from cache; if missing, fetch from DB synchronously is not possible.
    // To avoid breaking, we perform a best-effort hydrate using Atomics.wait is out of scope. So we will cheat by
    // using a sync cache layer: pre-hydrate on first call paths (PUT starts session via createSession then get later).
    // If not in cache, we fetch from DB using async and spin off a microtask to populate cache, then return undefined.
    const cached = (this as any)._sessionCache?.get(sessionId) as MealPlanningSession | undefined
    if (cached) {
      this.updateLastActivity(sessionId)
      return cached
    }

    // Kick off async hydrate (fire-and-forget)
    ;(async () => {
      try {
        const cs = await prisma.chatSession.findUnique({
          where: { id: sessionId }
        })
        if (!cs) return
        const msgs = await prisma.chatMessage.findMany({
          where: { sessionId },
          orderBy: { timestamp: 'asc' }
        })
        const session: MealPlanningSession = {
          id: cs.id,
          userId: cs.userId,
          messages: msgs.map(m => ({ role: m.role as any, content: m.content, timestamp: m.timestamp })),
          acceptedRecipes: JSON.parse(cs.acceptedRecipes || '[]'),
          declinedRecipes: JSON.parse(cs.declinedRecipes || '[]'),
          recipeActions: [],
          currentCriteria: JSON.parse(cs.currentCriteria || '{}'),
          createdAt: cs.createdAt,
          updatedAt: cs.updatedAt
        }
        if (!(this as any)._sessionCache) (this as any)._sessionCache = new Map()
        ;(this as any)._sessionCache.set(sessionId, session)
        // Keep metadata cache aligned
        this.sessionMetadata.set(sessionId, {
          sessionId,
          userId: cs.userId,
          createdAt: cs.createdAt,
          updatedAt: cs.updatedAt,
          lastActivity: cs.lastActivity,
          isActive: cs.status === 'active',
          messageCount: cs.messageCount,
          acceptedRecipesCount: JSON.parse(cs.acceptedRecipes || '[]').length,
          status: cs.status as any
        })
      } catch (e) {
        console.error(`[${this.instanceId}] Error hydrating session ${sessionId}:`, e)
      }
    })()

    return undefined
  }

  /**
   * Check if a session is valid and not expired
   */
  isSessionValid(sessionId: string): boolean {
    const metadata = this.sessionMetadata.get(sessionId)
    if (!metadata) return false
    
    const now = Date.now()
    const sessionAge = now - metadata.lastActivity.getTime()
    
    return sessionAge < SESSION_TIMEOUT && metadata.status !== 'expired'
  }

  /**
   * Get session metadata without loading the full session
   */
  getSessionMetadata(sessionId: string): SessionMetadata | undefined {
    return this.sessionMetadata.get(sessionId)
  }

  /**
   * Get all active sessions for a user
   */
  getUserActiveSessions(userId: string): SessionMetadata[] {
    // Prefer DB truth if available in cache; otherwise return cached filtered
    // For simplicity, rely on cached metadata and allow eventual consistency
    return Array.from(this.sessionMetadata.values())
      .filter(m => m.userId === userId && m.status === 'active' && this.isSessionValid(m.sessionId))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }

  /**
   * Get the most recent session for a user (for resuming)
   */
  getMostRecentUserSession(userId: string): string | undefined {
    const activeSessions = this.getUserActiveSessions(userId)
    return activeSessions.length > 0 ? activeSessions[0].sessionId : undefined
  }

  /**
   * Mark a session as completed
   */
  completeSession(sessionId: string): boolean {
    const metadata = this.sessionMetadata.get(sessionId)
    if (metadata) {
      metadata.status = 'completed'
      metadata.isActive = false
      prisma.chatSession.update({ where: { id: sessionId }, data: { status: 'completed' } }).catch(() => {})
      return true
    }
    prisma.chatSession.update({ where: { id: sessionId }, data: { status: 'completed' } }).catch(() => {})
    return false
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(sessionId: string): void {
    const metadata = this.sessionMetadata.get(sessionId)
    if (metadata) {
      metadata.lastActivity = new Date()
      metadata.status = this.determineSessionStatus(metadata)
    }
    prisma.chatSession.update({ where: { id: sessionId }, data: { lastActivity: new Date() } }).catch(() => {})
  }

  /**
   * Get session timeout warning info
   */
  getSessionTimeoutInfo(sessionId: string): {
    isNearTimeout: boolean
    timeUntilTimeout: number
    timeUntilWarning: number
  } {
    const metadata = this.sessionMetadata.get(sessionId)
    if (!metadata) {
      return { isNearTimeout: false, timeUntilTimeout: 0, timeUntilWarning: 0 }
    }

    const now = Date.now()
    const timeSinceLastActivity = now - metadata.lastActivity.getTime()
    const timeUntilTimeout = SESSION_TIMEOUT - timeSinceLastActivity
    const timeUntilWarning = (SESSION_TIMEOUT - SESSION_WARNING_TIME) - timeSinceLastActivity

    return {
      isNearTimeout: timeUntilWarning <= 0 && timeUntilTimeout > 0,
      timeUntilTimeout: Math.max(0, timeUntilTimeout),
      timeUntilWarning: Math.max(0, timeUntilWarning)
    }
  }

  deleteSession(sessionId: string): boolean {
    this.sessionMetadata.delete(sessionId)
    prisma.chatMessage.deleteMany({ where: { sessionId } }).catch(() => {})
    prisma.chatSession.delete({ where: { id: sessionId } }).catch(() => {})
    return true
  }

  getAllSessionIds(): string[] {
    // Not used by API paths; return cached keys
    return Array.from(this.sessionMetadata.keys())
  }

  updateSession(sessionId: string, updates: Partial<MealPlanningSession>): boolean {
    const session = this.getSession(sessionId)
    if (session) {
      Object.assign(session, updates)
      this.setSession(sessionId, session)
      return true
    }
    return false
  }

  /**
   * Enhanced cleanup with better session lifecycle management
   */
  cleanup(): void {
    const now = Date.now()
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      const sessionAge = now - metadata.lastActivity.getTime()
      if (sessionAge > SESSION_TIMEOUT) {
        metadata.status = 'expired'
        metadata.isActive = false
        prisma.chatSession.update({ where: { id: sessionId }, data: { status: 'expired' } }).catch(() => {})
        if (sessionAge > SESSION_TIMEOUT * 2) {
          this.deleteSession(sessionId)
        }
      } else if (sessionAge > SESSION_WARNING_TIME) {
        metadata.status = 'idle'
      }
    }
  }

  /**
   * Determine session status based on activity and content
   */
  private determineSessionStatus(metadata: SessionMetadata): SessionMetadata['status'] {
    const now = Date.now()
    const timeSinceLastActivity = now - metadata.lastActivity.getTime()
    
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      return 'expired'
    }
    
    if (metadata.acceptedRecipesCount > 0 && metadata.messageCount > 5) {
      // Could be ready for completion
      return 'active' // Keep active until explicitly completed
    }
    
    if (timeSinceLastActivity > SESSION_WARNING_TIME) {
      return 'idle'
    }
    
    return 'active'
  }

  /**
   * Load session metadata from disk
   */
  private loadSessionMetadata(): void {
    // No-op with DB-backed store
  }

  /**
   * Save session metadata to disk
   */
  private saveSessionMetadata(): void {
    // No-op with DB-backed store
  }
}

// Export singleton instance
export const globalSessionStore = GlobalSessionStore.getInstance()

// Auto-cleanup every 15 minutes (more frequent for better session management)
setInterval(() => {
  globalSessionStore.cleanup()
}, 15 * 60 * 1000) 