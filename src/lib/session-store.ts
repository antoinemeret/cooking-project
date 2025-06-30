import { MealPlanningSession } from './conversation-chain'
import fs from 'fs'
import path from 'path'

const SESSION_DIR = path.join(process.cwd(), '.next', 'sessions')
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
 * Enhanced file-based session store with better persistence and recovery
 * In production, this should be replaced with Redis or a database
 */
class GlobalSessionStore {
  private static instance: GlobalSessionStore
  private instanceId: string
  private sessionMetadata: Map<string, SessionMetadata> = new Map()

  private constructor() {
    this.instanceId = Math.random().toString(36).substring(7)
    console.log(`GlobalSessionStore instance created: ${this.instanceId}`)
    
    // Ensure session directory exists
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true })
    }

    // Load existing session metadata
    this.loadSessionMetadata()
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
  createSession(sessionId: string, session: MealPlanningSession): void {
    this.setSession(sessionId, session)
    
    const metadata: SessionMetadata = {
      sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivity: new Date(),
      isActive: true,
      messageCount: session.messages.length,
      acceptedRecipesCount: session.acceptedRecipes.length,
      status: 'active'
    }
    
    this.sessionMetadata.set(sessionId, metadata)
    this.saveSessionMetadata()
  }

  setSession(sessionId: string, session: MealPlanningSession): void {
    try {
      const sessionFile = path.join(SESSION_DIR, `${sessionId}.json`)
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2))
      
      // Update metadata
      const metadata = this.sessionMetadata.get(sessionId)
      if (metadata) {
        metadata.updatedAt = session.updatedAt
        metadata.lastActivity = new Date()
        metadata.messageCount = session.messages.length
        metadata.acceptedRecipesCount = session.acceptedRecipes.length
        metadata.status = this.determineSessionStatus(metadata)
        this.saveSessionMetadata()
      }
      
      console.log(`[${this.instanceId}] Session stored to file: ${sessionId}`)
    } catch (error) {
      console.error(`[${this.instanceId}] Error storing session ${sessionId}:`, error)
    }
  }

  getSession(sessionId: string): MealPlanningSession | undefined {
    try {
      const sessionFile = path.join(SESSION_DIR, `${sessionId}.json`)
      if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf8')
        const session = JSON.parse(sessionData)
        
        // Convert date strings back to Date objects
        session.createdAt = new Date(session.createdAt)
        session.updatedAt = new Date(session.updatedAt)
        session.messages.forEach((msg: any) => {
          msg.timestamp = new Date(msg.timestamp)
        })
        
        // Update last activity
        this.updateLastActivity(sessionId)
        
        console.log(`[${this.instanceId}] Session loaded from file: ${sessionId}`)
        return session
      } else {
        console.log(`[${this.instanceId}] Session file not found: ${sessionId}`)
        return undefined
      }
    } catch (error) {
      console.error(`[${this.instanceId}] Error loading session ${sessionId}:`, error)
      return undefined
    }
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
    return Array.from(this.sessionMetadata.values())
      .filter(metadata => 
        metadata.userId === userId && 
        metadata.status === 'active' && 
        this.isSessionValid(metadata.sessionId)
      )
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
      this.saveSessionMetadata()
      return true
    }
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
      this.saveSessionMetadata()
    }
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
    try {
      const sessionFile = path.join(SESSION_DIR, `${sessionId}.json`)
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile)
        this.sessionMetadata.delete(sessionId)
        this.saveSessionMetadata()
        console.log(`[${this.instanceId}] Session file deleted: ${sessionId}`)
        return true
      }
      return false
    } catch (error) {
      console.error(`[${this.instanceId}] Error deleting session ${sessionId}:`, error)
      return false
    }
  }

  getAllSessionIds(): string[] {
    try {
      if (!fs.existsSync(SESSION_DIR)) {
        return []
      }
      return fs.readdirSync(SESSION_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
    } catch (error) {
      console.error(`[${this.instanceId}] Error listing sessions:`, error)
      return []
    }
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
    try {
      if (!fs.existsSync(SESSION_DIR)) {
        return
      }
      
      const now = Date.now()
      const sessionFiles = fs.readdirSync(SESSION_DIR).filter(file => file.endsWith('.json'))
      
      for (const file of sessionFiles) {
        const sessionId = file.replace('.json', '')
        const metadata = this.sessionMetadata.get(sessionId)
        
        if (metadata) {
          const sessionAge = now - metadata.lastActivity.getTime()
          
          if (sessionAge > SESSION_TIMEOUT) {
            // Mark as expired first
            metadata.status = 'expired'
            metadata.isActive = false
            
            // Delete after additional grace period
            if (sessionAge > SESSION_TIMEOUT * 2) {
              this.deleteSession(sessionId)
            }
          }
        } else {
          // Orphaned session file without metadata - check file age
          const sessionFile = path.join(SESSION_DIR, file)
          const stats = fs.statSync(sessionFile)
          const fileAge = now - stats.mtime.getTime()
          
          if (fileAge > SESSION_TIMEOUT) {
            fs.unlinkSync(sessionFile)
            console.log(`[${this.instanceId}] Orphaned session file cleaned up: ${file}`)
          }
        }
      }
      
      this.saveSessionMetadata()
    } catch (error) {
      console.error(`[${this.instanceId}] Error during cleanup:`, error)
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
    try {
      const metadataFile = path.join(SESSION_DIR, '_metadata.json')
      if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile, 'utf8')
        const metadata = JSON.parse(data)
        
        // Convert date strings back to Date objects
        for (const [sessionId, meta] of Object.entries(metadata)) {
          const sessionMeta = meta as any
          this.sessionMetadata.set(sessionId, {
            ...sessionMeta,
            createdAt: new Date(sessionMeta.createdAt),
            updatedAt: new Date(sessionMeta.updatedAt),
            lastActivity: new Date(sessionMeta.lastActivity)
          })
        }
        
        console.log(`[${this.instanceId}] Loaded metadata for ${this.sessionMetadata.size} sessions`)
      }
    } catch (error) {
      console.error(`[${this.instanceId}] Error loading session metadata:`, error)
    }
  }

  /**
   * Save session metadata to disk
   */
  private saveSessionMetadata(): void {
    try {
      const metadataFile = path.join(SESSION_DIR, '_metadata.json')
      const metadata = Object.fromEntries(this.sessionMetadata.entries())
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
    } catch (error) {
      console.error(`[${this.instanceId}] Error saving session metadata:`, error)
    }
  }
}

// Export singleton instance
export const globalSessionStore = GlobalSessionStore.getInstance()

// Auto-cleanup every 15 minutes (more frequent for better session management)
setInterval(() => {
  globalSessionStore.cleanup()
}, 15 * 60 * 1000) 