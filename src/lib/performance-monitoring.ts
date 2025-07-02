/**
 * Performance Monitoring System
 * Tracks performance metrics, identifies bottlenecks, and provides detailed logging
 */

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  memoryBefore: NodeJS.MemoryUsage
  memoryAfter?: NodeJS.MemoryUsage
  memoryDelta?: number
  cpuBefore?: NodeJS.CpuUsage
  cpuAfter?: NodeJS.CpuUsage
  metadata?: Record<string, any>
}

interface ProcessingStageMetrics {
  stageName: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  errorType?: string
  retryCount?: number
  subMetrics: PerformanceMetric[]
  resourceUsage: {
    memoryPeak: number
    cpuTime: number
    fileSize?: number
    networkRequests?: number
  }
}

export interface PerformanceReport {
  sessionId: string
  totalDuration: number
  stages: ProcessingStageMetrics[]
  bottlenecks: Array<{
    stage: string
    issue: string
    impact: 'low' | 'medium' | 'high'
    suggestion: string
  }>
  systemMetrics: {
    memoryUsageAtStart: NodeJS.MemoryUsage
    memoryUsageAtEnd: NodeJS.MemoryUsage
    cpuUsageTotal: NodeJS.CpuUsage
    gcCollections?: number
  }
  qualityScore: number
  recommendations: string[]
}

export class PerformanceMonitor {
  private activeMetrics: Map<string, PerformanceMetric> = new Map()
  private stageMetrics: Map<string, ProcessingStageMetrics> = new Map()
  private sessionStart: Map<string, number> = new Map()
  private sessionMemoryStart: Map<string, NodeJS.MemoryUsage> = new Map()
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'

  constructor(logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.logLevel = logLevel
  }

  /**
   * Start monitoring a processing session
   */
  startSession(sessionId: string): void {
    this.sessionStart.set(sessionId, Date.now())
    this.sessionMemoryStart.set(sessionId, process.memoryUsage())
    this.log('info', `🚀 Started monitoring session: ${sessionId}`)
  }

  /**
   * Start monitoring a processing stage
   */
  startStage(sessionId: string, stageName: string, metadata?: Record<string, any>): void {
    const stageKey = `${sessionId}:${stageName}`
    const stage: ProcessingStageMetrics = {
      stageName,
      startTime: Date.now(),
      success: false,
      subMetrics: [],
      resourceUsage: {
        memoryPeak: process.memoryUsage().heapUsed,
        cpuTime: 0,
        networkRequests: 0
      }
    }

    this.stageMetrics.set(stageKey, stage)
    this.log('debug', `⏱️  Started stage: ${stageName} for session: ${sessionId}`, metadata)
  }

  /**
   * Start monitoring a specific metric within a stage
   */
  startMetric(sessionId: string, stageName: string, metricName: string, metadata?: Record<string, any>): string {
    const metricKey = `${sessionId}:${stageName}:${metricName}:${Date.now()}`
    const metric: PerformanceMetric = {
      name: metricName,
      startTime: Date.now(),
      memoryBefore: process.memoryUsage(),
      cpuBefore: process.cpuUsage(),
      metadata
    }

    this.activeMetrics.set(metricKey, metric)
    this.log('debug', `📊 Started metric: ${metricName} in stage: ${stageName}`, metadata)
    return metricKey
  }

  /**
   * End a specific metric
   */
  endMetric(metricKey: string, success: boolean = true, metadata?: Record<string, any>): PerformanceMetric | null {
    const metric = this.activeMetrics.get(metricKey)
    if (!metric) {
      this.log('warn', `⚠️  Metric not found: ${metricKey}`)
      return null
    }

    metric.endTime = Date.now()
    metric.duration = metric.endTime - metric.startTime
    metric.memoryAfter = process.memoryUsage()
    metric.cpuAfter = process.cpuUsage(metric.cpuBefore)
    
    // Calculate memory delta
    metric.memoryDelta = metric.memoryAfter.heapUsed - metric.memoryBefore.heapUsed

    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata }
    }

    // Add to stage metrics
    const [sessionId, stageName] = metricKey.split(':')
    const stageKey = `${sessionId}:${stageName}`
    const stage = this.stageMetrics.get(stageKey)
    if (stage) {
      stage.subMetrics.push(metric)
      stage.resourceUsage.memoryPeak = Math.max(
        stage.resourceUsage.memoryPeak, 
        metric.memoryAfter.heapUsed
      )
    }

    this.activeMetrics.delete(metricKey)
    
    this.log('debug', `✅ Completed metric: ${metric.name} in ${metric.duration}ms`, {
      duration: metric.duration,
      memoryDelta: this.formatBytes(metric.memoryDelta),
      cpuTime: metric.cpuAfter?.user || 0
    })

    return metric
  }

  /**
   * End a processing stage
   */
  endStage(sessionId: string, stageName: string, success: boolean, error?: string, retryCount?: number): ProcessingStageMetrics | null {
    const stageKey = `${sessionId}:${stageName}`
    const stage = this.stageMetrics.get(stageKey)
    if (!stage) {
      this.log('warn', `⚠️  Stage not found: ${stageKey}`)
      return null
    }

    stage.endTime = Date.now()
    stage.duration = stage.endTime - stage.startTime
    stage.success = success
    stage.retryCount = retryCount
    
    if (error) {
      stage.errorType = this.categorizeError(error)
    }

    // Calculate total CPU time from sub-metrics
    stage.resourceUsage.cpuTime = stage.subMetrics.reduce(
      (total, metric) => total + (metric.cpuAfter?.user || 0), 0
    )

    const statusIcon = success ? '✅' : '❌'
    this.log('info', `${statusIcon} Completed stage: ${stageName} in ${stage.duration}ms`, {
      success,
      duration: stage.duration,
      memoryPeak: this.formatBytes(stage.resourceUsage.memoryPeak),
      subMetrics: stage.subMetrics.length,
      retryCount
    })

    return stage
  }

  /**
   * End monitoring session and generate performance report
   */
  endSession(sessionId: string, success: boolean): PerformanceReport | null {
    const startTime = this.sessionStart.get(sessionId)
    const memoryStart = this.sessionMemoryStart.get(sessionId)
    
    if (!startTime || !memoryStart) {
      this.log('warn', `⚠️  Session not found: ${sessionId}`)
      return null
    }

    const endTime = Date.now()
    const totalDuration = endTime - startTime
    const memoryEnd = process.memoryUsage()

    // Gather all stages for this session
    const stages = Array.from(this.stageMetrics.entries())
      .filter(([key]) => key.startsWith(sessionId + ':'))
      .map(([_, stage]) => stage)

    // Analyze bottlenecks
    const bottlenecks = this.analyzeBottlenecks(stages, totalDuration)
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(stages, totalDuration, success)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(stages, bottlenecks, totalDuration)

    const report: PerformanceReport = {
      sessionId,
      totalDuration,
      stages,
      bottlenecks,
      systemMetrics: {
        memoryUsageAtStart: memoryStart,
        memoryUsageAtEnd: memoryEnd,
        cpuUsageTotal: process.cpuUsage()
      },
      qualityScore,
      recommendations
    }

    // Clean up session data
    this.sessionStart.delete(sessionId)
    this.sessionMemoryStart.delete(sessionId)
    stages.forEach(stage => {
      this.stageMetrics.delete(`${sessionId}:${stage.stageName}`)
    })

    this.log('info', `🎯 Session ${sessionId} completed in ${totalDuration}ms`, {
      success,
      qualityScore,
      bottlenecks: bottlenecks.length,
      stages: stages.length
    })

    return report
  }

  /**
   * Log performance-related network request
   */
  logNetworkRequest(sessionId: string, stageName: string, url: string, duration: number, status: number): void {
    const stageKey = `${sessionId}:${stageName}`
    const stage = this.stageMetrics.get(stageKey)
    if (stage) {
      stage.resourceUsage.networkRequests = (stage.resourceUsage.networkRequests || 0) + 1
    }

    this.log('debug', `🌐 Network request: ${url}`, {
      duration,
      status,
      stage: stageName
    })
  }

  /**
   * Log file operation
   */
  logFileOperation(sessionId: string, stageName: string, operation: string, filePath: string, size?: number, duration?: number): void {
    const stageKey = `${sessionId}:${stageName}`
    const stage = this.stageMetrics.get(stageKey)
    if (stage && size) {
      stage.resourceUsage.fileSize = Math.max(stage.resourceUsage.fileSize || 0, size)
    }

    this.log('debug', `📁 File ${operation}: ${filePath}`, {
      size: size ? this.formatBytes(size) : undefined,
      duration,
      stage: stageName
    })
  }

  /**
   * Analyze bottlenecks in processing stages
   */
  private analyzeBottlenecks(stages: ProcessingStageMetrics[], totalDuration: number): Array<{
    stage: string
    issue: string
    impact: 'low' | 'medium' | 'high'
    suggestion: string
  }> {
    const bottlenecks: Array<{
      stage: string
      issue: string
      impact: 'low' | 'medium' | 'high'
      suggestion: string
    }> = []

    for (const stage of stages) {
      if (!stage.duration) continue

      const stagePercentage = (stage.duration / totalDuration) * 100

      // High duration stages
      if (stagePercentage > 50) {
        bottlenecks.push({
          stage: stage.stageName,
          issue: `Takes ${stagePercentage.toFixed(1)}% of total processing time`,
          impact: 'high',
          suggestion: 'Consider optimization or parallel processing'
        })
      }

      // High retry count
      if (stage.retryCount && stage.retryCount > 2) {
        bottlenecks.push({
          stage: stage.stageName,
          issue: `Required ${stage.retryCount} retries`,
          impact: 'medium',
          suggestion: 'Investigate frequent failures and improve error handling'
        })
      }

      // High memory usage
      const memoryMB = stage.resourceUsage.memoryPeak / 1024 / 1024
      if (memoryMB > 200) {
        bottlenecks.push({
          stage: stage.stageName,
          issue: `High memory usage: ${memoryMB.toFixed(1)}MB`,
          impact: memoryMB > 500 ? 'high' : 'medium',
          suggestion: 'Consider streaming processing or memory optimization'
        })
      }

      // Slow sub-operations
      const slowMetrics = stage.subMetrics.filter(m => m.duration && m.duration > 5000)
      if (slowMetrics.length > 0) {
        bottlenecks.push({
          stage: stage.stageName,
          issue: `${slowMetrics.length} slow operations (>5s)`,
          impact: 'medium',
          suggestion: 'Profile slow operations: ' + slowMetrics.map(m => m.name).join(', ')
        })
      }
    }

    return bottlenecks
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(stages: ProcessingStageMetrics[], totalDuration: number, success: boolean): number {
    let score = success ? 70 : 30 // Base score

    // Time efficiency (30 points max)
    const timeScore = Math.max(0, 30 - (totalDuration / 1000)) // Lose 1 point per second
    score += Math.min(30, timeScore)

    // Stage success rate (20 points max)
    const successfulStages = stages.filter(s => s.success).length
    const successRate = stages.length > 0 ? successfulStages / stages.length : 0
    score += successRate * 20

    // Retry efficiency (10 points max)
    const totalRetries = stages.reduce((sum, s) => sum + (s.retryCount || 0), 0)
    const retryPenalty = Math.min(10, totalRetries * 2)
    score += 10 - retryPenalty

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(stages: ProcessingStageMetrics[], bottlenecks: any[], totalDuration: number): string[] {
    const recommendations: string[] = []

    // Time-based recommendations
    if (totalDuration > 45000) {
      recommendations.push('Consider enabling faster processing options (lower quality, fewer retries)')
    }

    // Memory-based recommendations
    const peakMemory = Math.max(...stages.map(s => s.resourceUsage.memoryPeak))
    if (peakMemory > 300 * 1024 * 1024) {
      recommendations.push('High memory usage detected - consider processing in smaller chunks')
    }

    // Stage-specific recommendations
    const slowestStage = stages.reduce((prev, current) => 
      (prev.duration || 0) > (current.duration || 0) ? prev : current
    )
    if (slowestStage.duration && slowestStage.duration > 20000) {
      recommendations.push(`${slowestStage.stageName} is the bottleneck - focus optimization here`)
    }

    // Failure-based recommendations
    const failedStages = stages.filter(s => !s.success)
    if (failedStages.length > 0) {
      recommendations.push(`${failedStages.length} stages failed - improve error handling and validation`)
    }

    // Network-based recommendations
    const networkHeavyStages = stages.filter(s => (s.resourceUsage.networkRequests || 0) > 3)
    if (networkHeavyStages.length > 0) {
      recommendations.push('Multiple network requests detected - consider caching or batching')
    }

    return recommendations
  }

  /**
   * Categorize error type for better tracking
   */
  private categorizeError(error: string): string {
    const lowerError = error.toLowerCase()
    
    if (lowerError.includes('timeout')) return 'timeout'
    if (lowerError.includes('network') || lowerError.includes('connection')) return 'network'
    if (lowerError.includes('memory') || lowerError.includes('heap')) return 'memory'
    if (lowerError.includes('file') || lowerError.includes('path')) return 'filesystem'
    if (lowerError.includes('validation') || lowerError.includes('invalid')) return 'validation'
    if (lowerError.includes('permission') || lowerError.includes('access')) return 'permission'
    
    return 'unknown'
  }

  /**
   * Format bytes for human readable output
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Logging with configurable levels
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    const currentLevel = levels[this.logLevel]
    
    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString()
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(metadata && { metadata })
      }
      
      if (level === 'error') {
        console.error(JSON.stringify(logEntry))
      } else if (level === 'warn') {
        console.warn(JSON.stringify(logEntry))
      } else {
        console.log(JSON.stringify(logEntry))
      }
    }
  }

  /**
   * Get current memory usage summary
   */
  getMemoryUsage(): { used: string; free: string; total: string } {
    const usage = process.memoryUsage()
    return {
      used: this.formatBytes(usage.heapUsed),
      free: this.formatBytes(usage.heapTotal - usage.heapUsed),
      total: this.formatBytes(usage.heapTotal)
    }
  }

  /**
   * Export performance data for external analysis
   */
  exportMetrics(sessionId?: string): any {
    if (sessionId) {
      const stages = Array.from(this.stageMetrics.entries())
        .filter(([key]) => key.startsWith(sessionId + ':'))
        .map(([_, stage]) => stage)
      
      return {
        sessionId,
        stages,
        timestamp: new Date().toISOString()
      }
    }

    return {
      activeSessions: Array.from(this.sessionStart.keys()),
      activeMetrics: this.activeMetrics.size,
      activeStages: this.stageMetrics.size,
      timestamp: new Date().toISOString()
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor(
  process.env.NODE_ENV === 'development' ? 'debug' : 'info'
) 