/**
 * Performance optimization utilities for the conversational recipe assistant
 */

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>()
const cacheTimeouts = new Map<string, NodeJS.Timeout>()

/**
 * Debounce function to limit API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function to limit API call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastTime = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= wait) {
      lastTime = now
      return func(...args)
    }
  }
}

/**
 * Deduplicate identical requests to prevent duplicate API calls
 */
export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = 5000 // 5 seconds default TTL
): Promise<T> {
  // Check if we already have this request in flight
  if (requestCache.has(key)) {
    return requestCache.get(key)!
  }

  // Create new request
  const request = requestFn()
  requestCache.set(key, request)

  // Set cleanup timeout
  const timeout = setTimeout(() => {
    requestCache.delete(key)
    cacheTimeouts.delete(key)
  }, ttl)
  cacheTimeouts.set(key, timeout)

  try {
    const result = await request
    return result
  } catch (error) {
    // Remove failed request from cache immediately
    requestCache.delete(key)
    const existingTimeout = cacheTimeouts.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      cacheTimeouts.delete(key)
    }
    throw error
  }
}

/**
 * Simple LRU cache for frequently accessed data
 */
export class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>()
  private maxSize: number
  private ttl: number

  constructor(maxSize: number = 100, ttl: number = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, item)
    return item.value
  }

  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Batch multiple API calls together
 */
export class APIBatcher<T, R> {
  private batch: T[] = []
  private timeout: NodeJS.Timeout | null = null
  private batchProcessor: (items: T[]) => Promise<R[]>
  private maxBatchSize: number
  private batchDelay: number
  private pendingPromises: Array<{
    resolve: (value: R) => void
    reject: (error: any) => void
  }> = []

  constructor(
    batchProcessor: (items: T[]) => Promise<R[]>,
    maxBatchSize: number = 10,
    batchDelay: number = 100
  ) {
    this.batchProcessor = batchProcessor
    this.maxBatchSize = maxBatchSize
    this.batchDelay = batchDelay
  }

  async add(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.batch.push(item)
      this.pendingPromises.push({ resolve, reject })

      // Process immediately if batch is full
      if (this.batch.length >= this.maxBatchSize) {
        this.processBatch()
        return
      }

      // Set timeout for batch processing
      if (this.timeout) {
        clearTimeout(this.timeout)
      }
      this.timeout = setTimeout(() => this.processBatch(), this.batchDelay)
    })
  }

  private async processBatch(): Promise<void> {
    if (this.batch.length === 0) return

    const currentBatch = [...this.batch]
    const currentPromises = [...this.pendingPromises]
    
    // Clear current batch
    this.batch = []
    this.pendingPromises = []
    
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    try {
      const results = await this.batchProcessor(currentBatch)
      
      // Resolve all promises with corresponding results
      currentPromises.forEach((promise, index) => {
        if (results[index] !== undefined) {
          promise.resolve(results[index])
        } else {
          promise.reject(new Error('No result for batched item'))
        }
      })
    } catch (error) {
      // Reject all promises with the error
      currentPromises.forEach(promise => promise.reject(error))
    }
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics = new Map<string, number[]>()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startTimer(key: string): () => void {
    const startTime = performance.now()
    return () => {
      const duration = performance.now() - startTime
      this.recordMetric(key, duration)
    }
  }

  recordMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    const values = this.metrics.get(key)!
    values.push(value)
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift()
    }
  }

  getMetrics(key: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(key)
    if (!values || values.length === 0) return null

    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const count = values.length

    return { avg, min, max, count }
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    
    for (const [key] of this.metrics) {
      const metrics = this.getMetrics(key)
      if (metrics) {
        result[key] = metrics
      }
    }
    
    return result
  }

  clear(): void {
    this.metrics.clear()
  }
}

/**
 * Optimize image loading with lazy loading and compression
 */
export function createOptimizedImageLoader() {
  const imageCache = new LRUCache<string>(50, 600000) // 10 minutes TTL
  
  return {
    loadImage: async (src: string, options?: { 
      quality?: number
      width?: number
      height?: number 
    }): Promise<string> => {
      const cacheKey = `${src}-${JSON.stringify(options || {})}`
      
      // Check cache first
      const cached = imageCache.get(cacheKey)
      if (cached) return cached
      
      // Load and potentially optimize image
      try {
        let optimizedSrc = src
        
        // Add optimization parameters if needed
        if (options?.quality || options?.width || options?.height) {
          const url = new URL(src, window.location.origin)
          if (options.quality) url.searchParams.set('q', options.quality.toString())
          if (options.width) url.searchParams.set('w', options.width.toString())
          if (options.height) url.searchParams.set('h', options.height.toString())
          optimizedSrc = url.toString()
        }
        
        // Preload image
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = optimizedSrc
        })
        
        imageCache.set(cacheKey, optimizedSrc)
        return optimizedSrc
      } catch (error) {
        console.error('Failed to load optimized image:', error)
        return src // Fallback to original
      }
    }
  }
}

/**
 * Optimize recipe filtering with memoization
 */
export function createMemoizedFilter<T>(
  filterFn: (items: T[], ...args: any[]) => T[]
) {
  const cache = new LRUCache<T[]>(20, 60000) // 1 minute TTL
  
  return (items: T[], ...args: any[]): T[] => {
    const cacheKey = `${items.length}-${JSON.stringify(args)}`
    
    const cached = cache.get(cacheKey)
    if (cached) return cached
    
    const result = filterFn(items, ...args)
    cache.set(cacheKey, result)
    return result
  }
}

/**
 * Cleanup function to clear all caches and timers
 */
export function cleanup(): void {
  // Clear request cache
  requestCache.clear()
  cacheTimeouts.forEach(timeout => clearTimeout(timeout))
  cacheTimeouts.clear()
  
  // Clear performance metrics
  PerformanceMonitor.getInstance().clear()
} 