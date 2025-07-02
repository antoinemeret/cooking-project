/**
 * Baseline Performance Measurement for Ollama Solution
 * 
 * This module provides tools to measure the current performance of the Ollama-based
 * recipe import system to establish benchmarks for comparison against traditional parsing.
 */

import { TEST_DATASETS, TestUrl } from '@/data/test-dataset'
import { prisma } from '@/lib/prisma'

export interface BaselineMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageProcessingTime: number
  medianProcessingTime: number
  p95ProcessingTime: number
  p99ProcessingTime: number
  successRate: number
  errorRate: number
  timeoutRate: number
  averageResponseSize: number
  resourceUsage: {
    peakMemoryMB: number
    avgCpuPercent: number
  }
}

export interface BaselineTestResult {
  url: string
  success: boolean
  processingTime: number
  responseSize: number
  errorType?: string
  errorMessage?: string
  timestamp: Date
  extractedData?: {
    title?: string
    ingredientsCount?: number
    instructionsCount?: number
  }
}

export interface BaselineReport {
  testRunId: string
  timestamp: Date
  dataset: string
  metrics: BaselineMetrics
  results: BaselineTestResult[]
  recommendations: string[]
  comparisonBenchmarks: {
    minimumAcceptableTime: number
    targetSuccessRate: number
    maxTimeoutRate: number
  }
}

/**
 * Run baseline performance measurement for Ollama solution
 */
export async function measureOllamaBaseline(
  datasetName: keyof typeof TEST_DATASETS = 'basic-evaluation',
  options: {
    maxConcurrent?: number
    timeoutMs?: number
    includeResourceUsage?: boolean
  } = {}
): Promise<BaselineReport> {
  const {
    maxConcurrent = 1,
    timeoutMs = 30000,
    includeResourceUsage = false
  } = options

  const dataset = TEST_DATASETS[datasetName]
  const testRunId = `baseline-${Date.now()}`
  const startTime = Date.now()

  console.log(`Starting baseline measurement for dataset: ${datasetName}`)
  console.log(`Testing ${dataset.urls.length} URLs with ${maxConcurrent} concurrent requests`)

  const results: BaselineTestResult[] = []
  const processingTimes: number[] = []
  let peakMemoryMB = 0
  let totalCpuTime = 0

  // Process URLs with controlled concurrency
  const urlBatches = createBatches(dataset.urls, maxConcurrent)
  
  for (const batch of urlBatches) {
    const batchResults = await Promise.all(
      batch.map(url => measureSingleUrl(url, timeoutMs))
    )
    
    results.push(...batchResults)
    processingTimes.push(...batchResults.map(r => r.processingTime))

    // Track resource usage if enabled
    if (includeResourceUsage) {
      const currentMemory = await getCurrentMemoryUsage()
      peakMemoryMB = Math.max(peakMemoryMB, currentMemory)
    }

    // Small delay between batches to prevent overwhelming the service
    if (batch.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const totalTime = Date.now() - startTime
  const metrics = calculateMetrics(results, processingTimes, {
    peakMemoryMB,
    avgCpuPercent: totalCpuTime / totalTime * 100
  })

  const report: BaselineReport = {
    testRunId,
    timestamp: new Date(),
    dataset: datasetName,
    metrics,
    results,
    recommendations: generateRecommendations(metrics),
    comparisonBenchmarks: {
      minimumAcceptableTime: metrics.averageProcessingTime * 0.8, // 20% improvement target
      targetSuccessRate: Math.max(0.9, metrics.successRate + 0.1), // 90% minimum or 10% improvement
      maxTimeoutRate: Math.max(0.02, metrics.timeoutRate * 0.5) // 2% maximum or 50% reduction
    }
  }

  // Store baseline results in database
  await storeBaselineResults(report)

  console.log(`Baseline measurement completed in ${totalTime}ms`)
  console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`)
  console.log(`Average processing time: ${metrics.averageProcessingTime.toFixed(0)}ms`)

  return report
}

/**
 * Measure performance of a single URL
 */
async function measureSingleUrl(
  testUrl: TestUrl,
  timeoutMs: number
): Promise<BaselineTestResult> {
  const startTime = Date.now()
  let responseSize = 0
  let extractedData: any = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Use the existing scrape endpoint (Ollama approach)
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: testUrl.url }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    responseSize = JSON.stringify(data).length
    
    // Extract key metrics from response
    if (data.success && data.recipe) {
      extractedData = {
        title: data.recipe.title,
        ingredientsCount: data.recipe.rawIngredients?.length || 0,
        instructionsCount: data.recipe.instructions?.split('.').length || 0
      }
    }

    return {
      url: testUrl.url,
      success: data.success === true,
      processingTime: Date.now() - startTime,
      responseSize,
      extractedData,
      timestamp: new Date(),
      errorType: data.success ? undefined : 'parsing_error',
      errorMessage: data.success ? undefined : data.error
    }

  } catch (error: any) {
    const processingTime = Date.now() - startTime
    
    let errorType = 'unknown_error'
    if (error.name === 'AbortError') {
      errorType = 'timeout'
    } else if (error.message.includes('fetch')) {
      errorType = 'network_error'
    } else if (error.message.includes('HTTP')) {
      errorType = 'http_error'
    }

    return {
      url: testUrl.url,
      success: false,
      processingTime,
      responseSize: 0,
      timestamp: new Date(),
      errorType,
      errorMessage: error.message
    }
  }
}

/**
 * Calculate comprehensive metrics from test results
 */
function calculateMetrics(
  results: BaselineTestResult[],
  processingTimes: number[],
  resourceUsage: { peakMemoryMB: number; avgCpuPercent: number }
): BaselineMetrics {
  const totalRequests = results.length
  const successfulRequests = results.filter(r => r.success).length
  const failedRequests = totalRequests - successfulRequests
  const timeoutRequests = results.filter(r => r.errorType === 'timeout').length

  // Sort processing times for percentile calculations
  const sortedTimes = [...processingTimes].sort((a, b) => a - b)
  
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageProcessingTime: processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length,
    medianProcessingTime: getPercentile(sortedTimes, 50),
    p95ProcessingTime: getPercentile(sortedTimes, 95),
    p99ProcessingTime: getPercentile(sortedTimes, 99),
    successRate: successfulRequests / totalRequests,
    errorRate: failedRequests / totalRequests,
    timeoutRate: timeoutRequests / totalRequests,
    averageResponseSize: results.reduce((sum, r) => sum + r.responseSize, 0) / results.length,
    resourceUsage
  }
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(metrics: BaselineMetrics): string[] {
  const recommendations: string[] = []

  // Success rate recommendations
  if (metrics.successRate < 0.8) {
    recommendations.push('Success rate is below 80% - investigate common failure patterns')
    recommendations.push('Consider implementing retry logic for failed requests')
  } else if (metrics.successRate < 0.9) {
    recommendations.push('Success rate could be improved - analyze failed requests for patterns')
  }

  // Performance recommendations
  if (metrics.averageProcessingTime > 15000) {
    recommendations.push('Average processing time exceeds 15 seconds - consider performance optimization')
    recommendations.push('Investigate if Ollama model can be optimized or replaced with faster variant')
  } else if (metrics.averageProcessingTime > 10000) {
    recommendations.push('Processing time is acceptable but could be improved for better user experience')
  }

  // Timeout recommendations
  if (metrics.timeoutRate > 0.1) {
    recommendations.push('High timeout rate (>10%) - consider increasing timeout threshold or optimizing slow requests')
  } else if (metrics.timeoutRate > 0.05) {
    recommendations.push('Some requests are timing out - monitor for patterns in slow URLs')
  }

  // Consistency recommendations
  const timeSpread = metrics.p95ProcessingTime - metrics.medianProcessingTime
  if (timeSpread > metrics.medianProcessingTime) {
    recommendations.push('High variance in processing times - investigate causes of slow outliers')
  }

  // Resource usage recommendations
  if (metrics.resourceUsage.peakMemoryMB > 1000) {
    recommendations.push('High memory usage detected - monitor for memory leaks')
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance metrics are within acceptable ranges')
    recommendations.push('Consider running extended tests with larger datasets')
  }

  return recommendations
}

/**
 * Store baseline results in database
 */
async function storeBaselineResults(report: BaselineReport): Promise<void> {
  try {
    // Store in performance metrics table
    await prisma.performanceMetrics.upsert({
      where: { 
        technology_dataset: {
          technology: 'ollama',
          dataset: report.dataset
        }
      },
      update: {
        totalRequests: report.metrics.totalRequests,
        successfulRequests: report.metrics.successfulRequests,
        failedRequests: report.metrics.failedRequests,
        averageTime: report.metrics.averageProcessingTime,
        medianTime: report.metrics.medianProcessingTime,
        p95Time: report.metrics.p95ProcessingTime,
        successRate: report.metrics.successRate,
        lastUpdated: report.timestamp
      },
      create: {
        technology: 'ollama',
        dataset: report.dataset,
        totalRequests: report.metrics.totalRequests,
        successfulRequests: report.metrics.successfulRequests,
        failedRequests: report.metrics.failedRequests,
        averageTime: report.metrics.averageProcessingTime,
        medianTime: report.metrics.medianProcessingTime,
        p95Time: report.metrics.p95ProcessingTime,
        successRate: report.metrics.successRate,
        lastUpdated: report.timestamp
      }
    })

    console.log(`Baseline results stored for ${report.dataset} dataset`)
  } catch (error) {
    console.error('Failed to store baseline results:', error)
    // Continue without throwing - baseline measurement shouldn't fail due to storage issues
  }
}

/**
 * Compare current performance against stored baseline
 */
export async function compareAgainstBaseline(
  currentMetrics: BaselineMetrics,
  dataset: string
): Promise<{
  improvements: string[]
  regressions: string[]
  overall: 'better' | 'worse' | 'similar'
}> {
  try {
    const baseline = await prisma.performanceMetrics.findUnique({
      where: {
        technology_dataset: {
          technology: 'ollama',
          dataset
        }
      }
    })

    if (!baseline) {
      return {
        improvements: [],
        regressions: ['No baseline data available for comparison'],
        overall: 'similar'
      }
    }

    const improvements: string[] = []
    const regressions: string[] = []

    // Compare success rates
    const successRateDiff = currentMetrics.successRate - baseline.successRate
    if (successRateDiff > 0.05) {
      improvements.push(`Success rate improved by ${(successRateDiff * 100).toFixed(1)}%`)
    } else if (successRateDiff < -0.05) {
      regressions.push(`Success rate decreased by ${(Math.abs(successRateDiff) * 100).toFixed(1)}%`)
    }

    // Compare processing times
    const timeDiff = currentMetrics.averageProcessingTime - baseline.averageTime
    if (timeDiff < -1000) {
      improvements.push(`Average processing time improved by ${Math.abs(timeDiff).toFixed(0)}ms`)
    } else if (timeDiff > 1000) {
      regressions.push(`Average processing time increased by ${timeDiff.toFixed(0)}ms`)
    }

    // Compare P95 times (consistency)
    const p95Diff = currentMetrics.p95ProcessingTime - baseline.p95Time
    if (p95Diff < -2000) {
      improvements.push(`P95 processing time improved by ${Math.abs(p95Diff).toFixed(0)}ms`)
    } else if (p95Diff > 2000) {
      regressions.push(`P95 processing time increased by ${p95Diff.toFixed(0)}ms`)
    }

    // Overall assessment
    let overall: 'better' | 'worse' | 'similar' = 'similar'
    if (improvements.length > regressions.length) {
      overall = 'better'
    } else if (regressions.length > improvements.length) {
      overall = 'worse'
    }

    return { improvements, regressions, overall }

  } catch (error) {
    console.error('Error comparing against baseline:', error)
    return {
      improvements: [],
      regressions: ['Error comparing against baseline'],
      overall: 'similar'
    }
  }
}

/**
 * Generate baseline performance report
 */
export async function generateBaselineReport(
  datasetName: keyof typeof TEST_DATASETS = 'basic-evaluation'
): Promise<string> {
  const report = await measureOllamaBaseline(datasetName, {
    maxConcurrent: 2,
    timeoutMs: 30000,
    includeResourceUsage: true
  })

  return `
# Ollama Baseline Performance Report

**Dataset:** ${report.dataset}
**Test Run ID:** ${report.testRunId}
**Timestamp:** ${report.timestamp.toISOString()}
**URLs Tested:** ${report.metrics.totalRequests}

## Performance Metrics

### Success Rates
- **Overall Success Rate:** ${(report.metrics.successRate * 100).toFixed(1)}%
- **Successful Requests:** ${report.metrics.successfulRequests}
- **Failed Requests:** ${report.metrics.failedRequests}
- **Timeout Rate:** ${(report.metrics.timeoutRate * 100).toFixed(1)}%

### Processing Times
- **Average:** ${report.metrics.averageProcessingTime.toFixed(0)}ms
- **Median:** ${report.metrics.medianProcessingTime.toFixed(0)}ms
- **95th Percentile:** ${report.metrics.p95ProcessingTime.toFixed(0)}ms
- **99th Percentile:** ${report.metrics.p99ProcessingTime.toFixed(0)}ms

### Resource Usage
- **Peak Memory:** ${report.metrics.resourceUsage.peakMemoryMB.toFixed(1)}MB
- **Average CPU:** ${report.metrics.resourceUsage.avgCpuPercent.toFixed(1)}%
- **Average Response Size:** ${report.metrics.averageResponseSize.toFixed(0)} bytes

## Benchmarks for Comparison

- **Target Processing Time:** < ${report.comparisonBenchmarks.minimumAcceptableTime.toFixed(0)}ms
- **Target Success Rate:** > ${(report.comparisonBenchmarks.targetSuccessRate * 100).toFixed(1)}%
- **Maximum Timeout Rate:** < ${(report.comparisonBenchmarks.maxTimeoutRate * 100).toFixed(1)}%

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Error Analysis

${analyzeErrors(report.results)}

## URL-Specific Results

${report.results.map(result => `
### ${result.url}
- **Status:** ${result.success ? '✅ Success' : '❌ Failed'}
- **Processing Time:** ${result.processingTime}ms
- **Response Size:** ${result.responseSize} bytes
${result.extractedData ? `- **Extracted:** ${result.extractedData.title} (${result.extractedData.ingredientsCount} ingredients, ${result.extractedData.instructionsCount} steps)` : ''}
${result.errorMessage ? `- **Error:** ${result.errorMessage}` : ''}
`).join('\n')}
  `.trim()
}

// Helper functions

function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

function getPercentile(sortedArray: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, index)] || 0
}

async function getCurrentMemoryUsage(): Promise<number> {
  // Simple memory usage estimation
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // Convert to MB
  }
  return 0
}

function analyzeErrors(results: BaselineTestResult[]): string {
  const errors = results.filter(r => !r.success)
  if (errors.length === 0) {
    return 'No errors encountered during testing.'
  }

  const errorTypes = errors.reduce((acc, error) => {
    const type = error.errorType || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(errorTypes)
    .map(([type, count]) => `- **${type}:** ${count} occurrences`)
    .join('\n')
} 