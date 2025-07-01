import { NextRequest, NextResponse } from 'next/server'
import { 
  generateComparisonSummary, 
  getRecentComparisons, 
  getPerformanceTrends,
  calculatePerformanceMetrics 
} from '@/lib/performance-metrics'

interface DashboardData {
  overview: {
    totalComparisons: number
    pendingEvaluations: number
    completedEvaluations: number
    lastUpdated: string
  }
  performance: {
    ollama: {
      successRate: number
      averageTime: number
      totalTests: number
      accuracy: number
    }
    traditional: {
      successRate: number
      averageTime: number
      totalTests: number
      accuracy: number
    }
    winner: {
      speed: 'ollama' | 'traditional' | 'tie'
      accuracy: 'ollama' | 'traditional' | 'tie'
      recommendation: 'ollama' | 'traditional' | 'inconclusive'
    }
  }
  trends: {
    last7Days: Array<{
      date: string
      ollama: { successRate: number; avgTime: number; tests: number }
      traditional: { successRate: number; avgTime: number; tests: number }
    }>
    last30Days: Array<{
      date: string
      ollama: { successRate: number; avgTime: number; tests: number }
      traditional: { successRate: number; avgTime: number; tests: number }
    }>
  }
  recentComparisons: Array<{
    id: string
    url: string
    domain: string
    timestamp: string
    ollamaSuccess: boolean
    traditionalSuccess: boolean
    evaluated: boolean
    speedWinner: 'ollama' | 'traditional'
  }>
  domainAnalysis: Array<{
    domain: string
    totalTests: number
    ollamaSuccessRate: number
    traditionalSuccessRate: number
  }>
}

/**
 * Analyze performance by domain
 */
async function analyzeDomainPerformance(comparisons: any[]) {
  const domainStats: Record<string, {
    total: number
    ollamaSuccess: number
    traditionalSuccess: number
  }> = {}

  for (const comparison of comparisons) {
    const domain = new URL(comparison.url).hostname
    
    if (!domainStats[domain]) {
      domainStats[domain] = { total: 0, ollamaSuccess: 0, traditionalSuccess: 0 }
    }
    
    domainStats[domain].total++
    if (comparison.ollamaResult.success) domainStats[domain].ollamaSuccess++
    if (comparison.traditionalResult.success) domainStats[domain].traditionalSuccess++
  }

  return Object.entries(domainStats)
    .filter(([_, stats]) => stats.total >= 2) // Only domains with 2+ tests
    .map(([domain, stats]) => ({
      domain,
      totalTests: stats.total,
      ollamaSuccessRate: (stats.ollamaSuccess / stats.total) * 100,
      traditionalSuccessRate: (stats.traditionalSuccess / stats.total) * 100
    }))
    .sort((a, b) => b.totalTests - a.totalTests)
    .slice(0, 10) // Top 10 domains
}

/**
 * Combine trends data for dashboard
 */
function combineTrends(ollamaTrends: any[], traditionalTrends: any[]) {
  const combined: Record<string, any> = {}

  // Process Ollama trends
  for (const trend of ollamaTrends) {
    combined[trend.date] = {
      date: trend.date,
      ollama: {
        successRate: trend.successRate,
        avgTime: trend.averageTime,
        tests: trend.totalTests
      },
      traditional: {
        successRate: 0,
        avgTime: 0,
        tests: 0
      }
    }
  }

  // Add Traditional trends
  for (const trend of traditionalTrends) {
    if (combined[trend.date]) {
      combined[trend.date].traditional = {
        successRate: trend.successRate,
        avgTime: trend.averageTime,
        tests: trend.totalTests
      }
    } else {
      combined[trend.date] = {
        date: trend.date,
        ollama: {
          successRate: 0,
          avgTime: 0,
          tests: 0
        },
        traditional: {
          successRate: trend.successRate,
          avgTime: trend.averageTime,
          tests: trend.totalTests
        }
      }
    }
  }

  return Object.values(combined).sort((a: any, b: any) => a.date.localeCompare(b.date))
}

/**
 * GET /api/recipes/import-comparison/dashboard
 * Get analytics dashboard data
 */
export async function GET(req: NextRequest): Promise<NextResponse<DashboardData | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url)
    const includeDetails = searchParams.get('details') === 'true'
    
    // Generate comparison summary
    const summary = await generateComparisonSummary()
    if (!summary) {
      return NextResponse.json({
        error: 'No comparison data available'
      }, { status: 404 })
    }

    // Get recent comparisons for analysis
    const recentComparisons = await getRecentComparisons(100)
    
    // Get performance trends
    const [
      ollama7Day, 
      traditional7Day,
      ollama30Day,
      traditional30Day
    ] = await Promise.all([
      getPerformanceTrends('ollama', 7),
      getPerformanceTrends('traditional', 7),
      getPerformanceTrends('ollama', 30),
      getPerformanceTrends('traditional', 30)
    ])

    // Analyze domain performance
    const domainAnalysis = await analyzeDomainPerformance(recentComparisons)

    // Format recent comparisons for dashboard
    const recentFormatted = recentComparisons.slice(0, 10).map((comparison: any) => ({
      id: comparison.id,
      url: comparison.url,
      domain: new URL(comparison.url).hostname,
      timestamp: comparison.timestamp.toISOString(),
      ollamaSuccess: comparison.ollamaResult.success,
      traditionalSuccess: comparison.traditionalResult.success,
      evaluated: Object.keys(comparison.evaluations || {}).length > 0,
      speedWinner: comparison.ollamaResult.processingTime < comparison.traditionalResult.processingTime ? 'ollama' : 'traditional' as 'ollama' | 'traditional'
    }))

    // Build dashboard data
    const dashboardData: DashboardData = {
      overview: {
        totalComparisons: summary.totalComparisons,
        pendingEvaluations: summary.pendingEvaluations,
        completedEvaluations: summary.completedEvaluations,
        lastUpdated: new Date().toISOString()
      },
      performance: {
        ollama: {
          successRate: summary.ollamaMetrics.successRate,
          averageTime: summary.ollamaMetrics.averageProcessingTime,
          totalTests: summary.ollamaMetrics.totalTests,
          accuracy: summary.ollamaMetrics.overallAccuracyRate
        },
        traditional: {
          successRate: summary.traditionalMetrics.successRate,
          averageTime: summary.traditionalMetrics.averageProcessingTime,
          totalTests: summary.traditionalMetrics.totalTests,
          accuracy: summary.traditionalMetrics.overallAccuracyRate
        },
        winner: {
          speed: summary.performanceWinner,
          accuracy: summary.accuracyWinner,
          recommendation: summary.recommendedTechnology
        }
      },
      trends: {
        last7Days: combineTrends(ollama7Day, traditional7Day),
        last30Days: combineTrends(ollama30Day, traditional30Day)
      },
      recentComparisons: recentFormatted,
      domainAnalysis
    }

    // Cache headers for performance
    const headers = {
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Content-Type': 'application/json'
    }

    return NextResponse.json(dashboardData, { status: 200, headers })

  } catch (error) {
    console.error('Dashboard data generation failed:', error)
    
    return NextResponse.json({
      error: `Failed to generate dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

/**
 * POST /api/recipes/import-comparison/dashboard/refresh
 * Force refresh of dashboard metrics
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Import the metrics update function
    const { updateStoredPerformanceMetrics } = await import('@/lib/performance-metrics')
    
    // Update stored performance metrics
    await updateStoredPerformanceMetrics()
    
    return NextResponse.json({
      success: true,
      message: 'Dashboard metrics refreshed successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 })

  } catch (error) {
    console.error('Dashboard refresh failed:', error)
    
    return NextResponse.json({
      error: `Failed to refresh dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
} 