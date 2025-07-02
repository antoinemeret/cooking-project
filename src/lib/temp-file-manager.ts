import { promises as fs } from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'

/**
 * Temporary file manager for video processing
 * Handles creation, cleanup and resource management of temporary files
 */
export interface ResourceTracker {
  sessionId: string
  startTime: number
  activePaths: Set<string>
  activeProcesses: Set<number>
  memoryUsage: number
  cleanupCallbacks: Map<string, () => Promise<void>>
  abortController?: AbortController
}

export class TempFileManager {
  private tempDir: string
  private activePaths: Set<string> = new Set()
  private cleanupCallbacks: Map<string, () => Promise<void>> = new Map()
  private activeSessions: Map<string, ResourceTracker> = new Map()
  private activeProcesses: Set<number> = new Set()
  private cleanupInProgress: boolean = false

  constructor(baseDir?: string) {
    // Use configured temp directory from Next.js config or fallback
    this.tempDir = baseDir || process.env.VIDEO_TEMP_DIR || '/tmp/video-processing'
    
    // Initialize periodic cleanup
    this.initializePeriodicCleanup()
  }

  /**
   * Initialize temporary directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create temp directory ${this.tempDir}: ${error}`)
    }
  }

  /**
   * Initialize periodic cleanup tasks
   */
  private initializePeriodicCleanup(): void {
    // Cleanup old files every 30 minutes
    setInterval(() => {
      this.cleanupOldFiles(1).catch(error => 
        console.warn('Periodic cleanup failed:', error)
      )
    }, 30 * 60 * 1000)

    // Monitor resource usage every 5 minutes
    setInterval(() => {
      this.monitorResourceUsage().catch(error => 
        console.warn('Resource monitoring failed:', error)
      )
    }, 5 * 60 * 1000)
  }

  /**
   * Create a new processing session with resource tracking
   */
  createSession(abortController?: AbortController): string {
    const sessionId = randomUUID()
    const tracker: ResourceTracker = {
      sessionId,
      startTime: Date.now(),
      activePaths: new Set(),
      activeProcesses: new Set(),
      memoryUsage: process.memoryUsage().heapUsed,
      cleanupCallbacks: new Map(),
      abortController
    }

    this.activeSessions.set(sessionId, tracker)
    
    // Set up abort handling
    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        this.forceCleanupSession(sessionId).catch(error =>
          console.error(`Failed to cleanup aborted session ${sessionId}:`, error)
        )
      })
    }

    return sessionId
  }

  /**
   * Track process for a session
   */
  trackProcess(sessionId: string, processId: number): void {
    const tracker = this.activeSessions.get(sessionId)
    if (tracker) {
      tracker.activeProcesses.add(processId)
      this.activeProcesses.add(processId)
    }
  }

  /**
   * Untrack process for a session
   */
  untrackProcess(sessionId: string, processId: number): void {
    const tracker = this.activeSessions.get(sessionId)
    if (tracker) {
      tracker.activeProcesses.delete(processId)
      this.activeProcesses.delete(processId)
    }
  }

  /**
   * Monitor resource usage and cleanup if necessary
   */
  private async monitorResourceUsage(): Promise<void> {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024

    // If heap usage is over 500MB, trigger cleanup
    if (heapUsedMB > 500) {
      console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`)
      await this.emergencyCleanup()
    }

    // Check for stuck sessions (running over 5 minutes)
    const now = Date.now()
    for (const [sessionId, tracker] of this.activeSessions) {
      const age = now - tracker.startTime
      if (age > 5 * 60 * 1000) { // 5 minutes
        console.warn(`Stuck session detected: ${sessionId}, age: ${Math.round(age/1000)}s`)
        await this.forceCleanupSession(sessionId)
      }
    }
  }

  /**
   * Emergency cleanup for resource pressure
   */
  private async emergencyCleanup(): Promise<void> {
    console.log('Starting emergency cleanup...')
    
    // Kill old processes first
    for (const pid of this.activeProcesses) {
      try {
        process.kill(pid, 'SIGTERM')
        console.log(`Terminated process ${pid}`)
      } catch (error) {
        // Process might already be dead
      }
    }

    // Clean up old sessions
    const oldSessions = Array.from(this.activeSessions.entries())
      .filter(([_, tracker]) => Date.now() - tracker.startTime > 2 * 60 * 1000) // 2 minutes
      .map(([sessionId]) => sessionId)

    for (const sessionId of oldSessions) {
      await this.forceCleanupSession(sessionId)
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Force cleanup of a session (for timeouts/cancellation)
   */
  async forceCleanupSession(sessionId: string): Promise<void> {
    const tracker = this.activeSessions.get(sessionId)
    if (!tracker) return

    console.log(`Force cleaning up session: ${sessionId}`)

    try {
      // Kill all active processes for this session
      for (const pid of tracker.activeProcesses) {
        try {
          process.kill(pid, 'SIGKILL') // Force kill
          console.log(`Force killed process ${pid}`)
        } catch (error) {
          // Process might already be dead
        }
      }

      // Clean up all paths for this session
      const cleanupPromises = Array.from(tracker.activePaths).map(filePath =>
        this.cleanupFile(filePath).catch(error =>
          console.warn(`Failed to cleanup file ${filePath}:`, error)
        )
      )

      await Promise.allSettled(cleanupPromises)

      // Remove session tracker
      this.activeSessions.delete(sessionId)

    } catch (error) {
      console.error(`Error during force cleanup of session ${sessionId}:`, error)
    }
  }

  /**
   * Create a unique temporary file path
   */
  createTempPath(extension: string): string {
    const filename = `${randomUUID()}.${extension.replace('.', '')}`
    const fullPath = path.join(this.tempDir, filename)
    this.activePaths.add(fullPath)
    return fullPath
  }

  /**
   * Create temporary file path for video processing session
   */
  createSessionPaths(sessionId?: string): {
    sessionDir: string
    videoPath: string
    audioPath: string
    transcriptPath: string
  } {
    const session = sessionId || randomUUID()
    const sessionDir = path.join(this.tempDir, session)
    
    const paths = {
      sessionDir,
      videoPath: path.join(sessionDir, 'video.mp4'),
      audioPath: path.join(sessionDir, 'audio.wav'),
      transcriptPath: path.join(sessionDir, 'transcript.txt')
    }

    // Track all paths for cleanup
    Object.values(paths).forEach(p => this.activePaths.add(p))
    
    return paths
  }

  /**
   * Ensure session directory exists
   */
  async ensureSessionDir(sessionDir: string): Promise<void> {
    try {
      await fs.mkdir(sessionDir, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create session directory ${sessionDir}: ${error}`)
    }
  }

  /**
   * Register cleanup callback for a path
   */
  registerCleanup(filePath: string, callback: () => Promise<void>): void {
    this.cleanupCallbacks.set(filePath, callback)
  }

  /**
   * Clean up a specific file
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      // Run cleanup callback if registered
      const callback = this.cleanupCallbacks.get(filePath)
      if (callback) {
        await callback()
        this.cleanupCallbacks.delete(filePath)
      }

      // Remove file if it exists
      await fs.unlink(filePath)
      this.activePaths.delete(filePath)
    } catch (error: any) {
      // Ignore file not found errors
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to cleanup file ${filePath}:`, error.message)
      }
    }
  }

  /**
   * Clean up session directory and all its contents
   */
  async cleanupSession(sessionDir: string): Promise<void> {
    try {
      // Clean up all files in session directory
      const files = await fs.readdir(sessionDir).catch(() => [])
      
      for (const file of files) {
        const filePath = path.join(sessionDir, file)
        await this.cleanupFile(filePath)
      }

      // Remove session directory
      await fs.rmdir(sessionDir)
      this.activePaths.delete(sessionDir)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to cleanup session ${sessionDir}:`, error.message)
      }
    }
  }

  /**
   * Clean up all tracked temporary files
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.activePaths).map(filePath => 
      this.cleanupFile(filePath)
    )
    
    await Promise.allSettled(cleanupPromises)
    this.activePaths.clear()
    this.cleanupCallbacks.clear()
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath)
      return stats.size
    } catch {
      return 0
    }
  }

  /**
   * Get disk usage for temp directory
   */
  async getDiskUsage(): Promise<{ used: number; files: number }> {
    try {
      const files = await fs.readdir(this.tempDir, { withFileTypes: true })
      let totalSize = 0
      let fileCount = 0

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(this.tempDir, file.name)
          const size = await this.getFileSize(filePath)
          totalSize += size
          fileCount++
        }
      }

      return { used: totalSize, files: fileCount }
    } catch {
      return { used: 0, files: 0 }
    }
  }

  /**
   * Clean up old temporary files (older than specified hours)
   */
  async cleanupOldFiles(hoursOld: number = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.tempDir, { withFileTypes: true })
      const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000)
      let cleanedCount = 0

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(this.tempDir, file.name)
          const stats = await fs.stat(filePath)
          
          if (stats.mtime.getTime() < cutoffTime) {
            await this.cleanupFile(filePath)
            cleanedCount++
          }
        }
      }

      return cleanedCount
    } catch (error) {
      console.warn('Failed to cleanup old files:', error)
      return 0
    }
  }

  /**
   * Get active paths count
   */
  getActivePathsCount(): number {
    return this.activePaths.size
  }

  /**
   * Get temp directory path
   */
  getTempDir(): string {
    return this.tempDir
  }
}

// Singleton instance for global use
export const tempFileManager = new TempFileManager()

// Utility functions for common operations
export async function withTempFile<T>(
  extension: string,
  operation: (filePath: string) => Promise<T>
): Promise<T> {
  const filePath = tempFileManager.createTempPath(extension)
  
  try {
    return await operation(filePath)
  } finally {
    await tempFileManager.cleanupFile(filePath)
  }
}

export async function withTempSession<T>(
  operation: (paths: {
    sessionDir: string
    videoPath: string
    audioPath: string
    transcriptPath: string
  }, sessionId: string) => Promise<T>,
  abortController?: AbortController
): Promise<T> {
  const sessionId = tempFileManager.createSession(abortController)
  const paths = tempFileManager.createSessionPaths(sessionId)
  
  try {
    await tempFileManager.ensureSessionDir(paths.sessionDir)
    return await operation(paths, sessionId)
  } finally {
    await tempFileManager.cleanupSession(paths.sessionDir)
    await tempFileManager.forceCleanupSession(sessionId)
  }
}

export async function withTrackedTempSession<T>(
  operation: (
    paths: {
      sessionDir: string
      videoPath: string
      audioPath: string
      transcriptPath: string
    }, 
    sessionId: string,
    tracker: {
      trackProcess: (pid: number) => void
      untrackProcess: (pid: number) => void
      isAborted: () => boolean
    }
  ) => Promise<T>,
  abortController?: AbortController
): Promise<T> {
  const sessionId = tempFileManager.createSession(abortController)
  const paths = tempFileManager.createSessionPaths(sessionId)
  
  const tracker = {
    trackProcess: (pid: number) => tempFileManager.trackProcess(sessionId, pid),
    untrackProcess: (pid: number) => tempFileManager.untrackProcess(sessionId, pid),
    isAborted: () => abortController?.signal.aborted || false
  }
  
  try {
    await tempFileManager.ensureSessionDir(paths.sessionDir)
    return await operation(paths, sessionId, tracker)
  } finally {
    await tempFileManager.cleanupSession(paths.sessionDir)
    await tempFileManager.forceCleanupSession(sessionId)
  }
}

// Process cleanup handlers
process.on('exit', () => {
  // Synchronous cleanup on exit
  console.log('Cleaning up temporary files on exit...')
})

process.on('SIGINT', async () => {
  console.log('Received SIGINT, cleaning up temporary files...')
  await tempFileManager.cleanupAll()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, cleaning up temporary files...')
  await tempFileManager.cleanupAll()
  process.exit(0)
})

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception, cleaning up temporary files:', error)
  await tempFileManager.cleanupAll()
  process.exit(1)
})

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection, cleaning up temporary files:', reason)
  await tempFileManager.cleanupAll()
  process.exit(1)
}) 