import { MealPlanningSession } from './conversation-chain'
import fs from 'fs'
import path from 'path'

const SESSION_DIR = path.join(process.cwd(), '.next', 'sessions')

/**
 * File-based session store that persists across API route instances
 * In production, this should be replaced with Redis or a database
 */
class GlobalSessionStore {
  private static instance: GlobalSessionStore
  private instanceId: string

  private constructor() {
    this.instanceId = Math.random().toString(36).substring(7)
    console.log(`GlobalSessionStore instance created: ${this.instanceId}`)
    
    // Ensure session directory exists
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true })
    }
  }

  static getInstance(): GlobalSessionStore {
    if (!GlobalSessionStore.instance) {
      GlobalSessionStore.instance = new GlobalSessionStore()
    }
    return GlobalSessionStore.instance
  }

  setSession(sessionId: string, session: MealPlanningSession): void {
    try {
      const sessionFile = path.join(SESSION_DIR, `${sessionId}.json`)
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2))
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

  deleteSession(sessionId: string): boolean {
    try {
      const sessionFile = path.join(SESSION_DIR, `${sessionId}.json`)
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile)
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

  // Cleanup expired sessions (older than 2 hours)
  cleanup(): void {
    try {
      if (!fs.existsSync(SESSION_DIR)) {
        return
      }
      
      const now = Date.now()
      const twoHours = 2 * 60 * 60 * 1000
      
      const sessionFiles = fs.readdirSync(SESSION_DIR).filter(file => file.endsWith('.json'))
      
      for (const file of sessionFiles) {
        const sessionFile = path.join(SESSION_DIR, file)
        const stats = fs.statSync(sessionFile)
        const fileAge = now - stats.mtime.getTime()
        
        if (fileAge > twoHours) {
          fs.unlinkSync(sessionFile)
          console.log(`[${this.instanceId}] Expired session file cleaned up: ${file}`)
        }
      }
    } catch (error) {
      console.error(`[${this.instanceId}] Error during cleanup:`, error)
    }
  }
}

// Export singleton instance
export const globalSessionStore = GlobalSessionStore.getInstance()

// Auto-cleanup every 30 minutes
setInterval(() => {
  globalSessionStore.cleanup()
}, 30 * 60 * 1000) 