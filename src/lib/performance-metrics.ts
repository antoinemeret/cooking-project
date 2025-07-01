import { prisma } from '@/lib/prisma'
import { PerformanceMetrics, ComparisonSummary, ParsingResult } from '@/types/comparison'

/**
 * Calculate aggregated performance metrics for a specific technology
 */
export async function calculatePerformanceMetrics(technologyName: 'ollama' | 'traditional'): Promise<PerformanceMetrics | null> {
  try {
    // Fetch all comparison results
    const comparisons = await (prisma as any).comparisonResult.findMany({
      include: {
        evaluations: {
          where: { technology: technologyName }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 1000 // Limit to last 1000 comparisons for performance
    })

    if (comparisons.length === 0) {
      return null
    }

    // Parse and aggregate results
    let totalTests = 0
    let successfulParses = 0
    let failedParses = 0
    let processingTimes: number[] = []
    let titleAccuracyCount = 0
    let ingredientsAccuracyCount = 0
    let instructionsAccuracyCount = 0
    let overallAccuracyCount = 0
    let evaluatedCount = 0

    for (const comparison of comparisons) {
      totalTests++

      // Parse the results JSON
      const resultField = technologyName === 'ollama' ? 'ollamaResult' : 'traditionalResult'
      const result: ParsingResult = JSON.parse(comparison[resultField])

      // Count successful/failed parses
      if (result.success) {
        successfulParses++
      } else {
        failedParses++
      }

      // Collect processing times
      processingTimes.push(result.processingTime)

      // Count accuracy metrics from manual evaluations
      const evaluation = comparison.evaluations[0] // Should only be one per technology
      if (evaluation) {
        evaluatedCount++
        if (evaluation.titleAccurate === true) titleAccuracyCount++
        if (evaluation.ingredientsAccurate === true) ingredientsAccuracyCount++
        if (evaluation.instructionsAccurate === true) instructionsAccuracyCount++
        if (evaluation.overallSuccess === true) overallAccuracyCount++
      }
    }

    // Calculate statistics
    const averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    const successRate = (successfulParses / totalTests) * 100
    const sortedTimes = processingTimes.sort((a, b) => a - b)
    const medianProcessingTime = sortedTimes[Math.floor(sortedTimes.length / 2)]

    // Calculate accuracy rates (only if we have evaluations)
    const titleAccuracyRate = evaluatedCount > 0 ? (titleAccuracyCount / evaluatedCount) * 100 : 0
    const ingredientsAccuracyRate = evaluatedCount > 0 ? (ingredientsAccuracyCount / evaluatedCount) * 100 : 0
    const instructionsAccuracyRate = evaluatedCount > 0 ? (instructionsAccuracyCount / evaluatedCount) * 100 : 0
    const overallAccuracyRate = evaluatedCount > 0 ? (overallAccuracyCount / evaluatedCount) * 100 : 0

    return {
      technologyName,
      totalTests,
      successfulParses,
      failedParses,
      averageProcessingTime,
      successRate,
      titleAccuracyRate,
      ingredientsAccuracyRate,
      instructionsAccuracyRate,
      overallAccuracyRate,
      fastestParse: Math.min(...processingTimes),
      slowestParse: Math.max(...processingTimes),
      medianProcessingTime,
      lastUpdated: new Date()
    }
  } catch (error) {
    console.error(`Failed to calculate performance metrics for ${technologyName}:`, error)
    return null
  }
}

/**
 * Generate comprehensive comparison summary
 */
export async function generateComparisonSummary(): Promise<ComparisonSummary | null> {
  try {
    // Calculate metrics for both technologies
    const [ollamaMetrics, traditionalMetrics] = await Promise.all([
      calculatePerformanceMetrics('ollama'),
      calculatePerformanceMetrics('traditional')
    ])

    if (!ollamaMetrics || !traditionalMetrics) {
      return null
    }

    // Count comparison statuses
    const totalComparisons = await (prisma as any).comparisonResult.count()
    const completedEvaluations = await (prisma as any).comparisonResult.count({
      where: { status: 'evaluated' }
    })
    const pendingEvaluations = totalComparisons - completedEvaluations

    // Determine winners
    const performanceWinner = ollamaMetrics.averageProcessingTime < traditionalMetrics.averageProcessingTime ? 'ollama' : 
                              traditionalMetrics.averageProcessingTime < ollamaMetrics.averageProcessingTime ? 'traditional' : 'tie'
    
    const accuracyWinner = ollamaMetrics.overallAccuracyRate > traditionalMetrics.overallAccuracyRate ? 'ollama' : 
                           traditionalMetrics.overallAccuracyRate > ollamaMetrics.overallAccuracyRate ? 'traditional' : 'tie'

    // Make recommendation based on combined factors
    let recommendedTechnology: 'ollama' | 'traditional' | 'inconclusive' = 'inconclusive'
    
    if (ollamaMetrics.overallAccuracyRate > traditionalMetrics.overallAccuracyRate + 10) {
      recommendedTechnology = 'ollama'
    } else if (traditionalMetrics.overallAccuracyRate > ollamaMetrics.overallAccuracyRate + 10) {
      recommendedTechnology = 'traditional'
    } else if (performanceWinner !== 'tie') {
      recommendedTechnology = performanceWinner as 'ollama' | 'traditional'
    }

    return {
      totalComparisons,
      pendingEvaluations,
      completedEvaluations,
      ollamaMetrics,
      traditionalMetrics,
      performanceWinner,
      accuracyWinner,
      recommendedTechnology,
      generatedAt: new Date()
    }
  } catch (error) {
    console.error('Failed to generate comparison summary:', error)
    return null
  }
}

/**
 * Get recent comparison results with evaluations
 */
export async function getRecentComparisons(limit: number = 20) {
  try {
    const comparisons = await (prisma as any).comparisonResult.findMany({
      include: {
        evaluations: true
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    // Format the results
    return comparisons.map((comparison: any) => ({
      id: comparison.id,
      url: comparison.url,
      timestamp: comparison.timestamp,
      ollamaResult: JSON.parse(comparison.ollamaResult),
      traditionalResult: JSON.parse(comparison.traditionalResult),
      status: comparison.status,
      notes: comparison.notes,
      evaluations: comparison.evaluations.reduce((acc: any, evaluation: any) => {
        acc[evaluation.technology] = {
          titleAccurate: evaluation.titleAccurate,
          ingredientsAccurate: evaluation.ingredientsAccurate,
          instructionsAccurate: evaluation.instructionsAccurate,
          overallSuccess: evaluation.overallSuccess,
          evaluatedAt: evaluation.evaluatedAt,
          evaluatorNotes: evaluation.evaluatorNotes
        }
        return acc
      }, {})
    }))
  } catch (error) {
    console.error('Failed to fetch recent comparisons:', error)
    return []
  }
}

/**
 * Update stored performance metrics in database
 */
export async function updateStoredPerformanceMetrics(): Promise<void> {
  try {
    const [ollamaMetrics, traditionalMetrics] = await Promise.all([
      calculatePerformanceMetrics('ollama'),
      calculatePerformanceMetrics('traditional')
    ])

    if (ollamaMetrics) {
      await (prisma as any).performanceMetrics.upsert({
        where: { technologyName: 'ollama' },
        update: {
          totalTests: ollamaMetrics.totalTests,
          successfulParses: ollamaMetrics.successfulParses,
          failedParses: ollamaMetrics.failedParses,
          averageProcessingTime: ollamaMetrics.averageProcessingTime,
          successRate: ollamaMetrics.successRate,
          titleAccuracyRate: ollamaMetrics.titleAccuracyRate,
          ingredientsAccuracyRate: ollamaMetrics.ingredientsAccuracyRate,
          instructionsAccuracyRate: ollamaMetrics.instructionsAccuracyRate,
          overallAccuracyRate: ollamaMetrics.overallAccuracyRate,
          fastestParse: ollamaMetrics.fastestParse,
          slowestParse: ollamaMetrics.slowestParse,
          medianProcessingTime: ollamaMetrics.medianProcessingTime,
          lastUpdated: new Date()
        },
        create: ollamaMetrics
      })
    }

    if (traditionalMetrics) {
      await (prisma as any).performanceMetrics.upsert({
        where: { technologyName: 'traditional' },
        update: {
          totalTests: traditionalMetrics.totalTests,
          successfulParses: traditionalMetrics.successfulParses,
          failedParses: traditionalMetrics.failedParses,
          averageProcessingTime: traditionalMetrics.averageProcessingTime,
          successRate: traditionalMetrics.successRate,
          titleAccuracyRate: traditionalMetrics.titleAccuracyRate,
          ingredientsAccuracyRate: traditionalMetrics.ingredientsAccuracyRate,
          instructionsAccuracyRate: traditionalMetrics.instructionsAccuracyRate,
          overallAccuracyRate: traditionalMetrics.overallAccuracyRate,
          fastestParse: traditionalMetrics.fastestParse,
          slowestParse: traditionalMetrics.slowestParse,
          medianProcessingTime: traditionalMetrics.medianProcessingTime,
          lastUpdated: new Date()
        },
        create: traditionalMetrics
      })
    }

    console.log('Performance metrics updated successfully')
  } catch (error) {
    console.error('Failed to update stored performance metrics:', error)
  }
}

/**
 * Get performance trends over time
 */
export async function getPerformanceTrends(technologyName: 'ollama' | 'traditional', days: number = 30) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const comparisons = await (prisma as any).comparisonResult.findMany({
      where: {
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'asc' }
    })

    // Group by day and calculate daily metrics
    const dailyMetrics: Record<string, { successCount: number; totalCount: number; avgTime: number }> = {}

    for (const comparison of comparisons) {
      const dateKey = comparison.timestamp.toISOString().split('T')[0]
      const resultField = technologyName === 'ollama' ? 'ollamaResult' : 'traditionalResult'
      const result: ParsingResult = JSON.parse(comparison[resultField])

      if (!dailyMetrics[dateKey]) {
        dailyMetrics[dateKey] = { successCount: 0, totalCount: 0, avgTime: 0 }
      }

      dailyMetrics[dateKey].totalCount++
      if (result.success) {
        dailyMetrics[dateKey].successCount++
      }
      dailyMetrics[dateKey].avgTime += result.processingTime
    }

    // Calculate averages and format for charting
    return Object.entries(dailyMetrics).map(([date, metrics]) => ({
      date,
      successRate: (metrics.successCount / metrics.totalCount) * 100,
      averageTime: metrics.avgTime / metrics.totalCount,
      totalTests: metrics.totalCount
    }))
  } catch (error) {
    console.error('Failed to get performance trends:', error)
    return []
  }
} 