import { NextRequest, NextResponse } from 'next/server'
import { getRecentComparisons } from '@/lib/performance-metrics'

/**
 * Format comparison data for CSV export
 */
function formatForCSV(comparisons: any[]): string {
  const headers = [
    'comparison_id',
    'url',
    'timestamp',
    'domain',
    
    // Ollama results
    'ollama_success',
    'ollama_processing_time',
    'ollama_parsing_method',
    'ollama_title',
    'ollama_ingredients_count',
    'ollama_has_instructions',
    'ollama_error',
    
    // Traditional results
    'traditional_success',
    'traditional_processing_time',
    'traditional_parsing_method',
    'traditional_title',
    'traditional_ingredients_count',
    'traditional_has_instructions',
    'traditional_error',
    
    // Evaluations
    'ollama_title_accurate',
    'ollama_ingredients_accurate',
    'ollama_instructions_accurate',
    'ollama_overall_success',
    'traditional_title_accurate',
    'traditional_ingredients_accurate',
    'traditional_instructions_accurate',
    'traditional_overall_success',
    
    // Performance comparison
    'speed_winner',
    'accuracy_winner'
  ]

  const rows = comparisons.map(comparison => {
    const domain = new URL(comparison.url).hostname
    const ollamaResult = comparison.ollamaResult
    const traditionalResult = comparison.traditionalResult
    const ollamaEval = comparison.evaluations?.ollama
    const traditionalEval = comparison.evaluations?.traditional
    
    const speedWinner = ollamaResult.processingTime < traditionalResult.processingTime ? 'ollama' : 'traditional'
    const accuracyWinner = (ollamaEval?.overallSuccess && !traditionalEval?.overallSuccess) ? 'ollama' :
                          (!ollamaEval?.overallSuccess && traditionalEval?.overallSuccess) ? 'traditional' : 'tie'

    return [
      comparison.id,
      comparison.url,
      comparison.timestamp.toISOString(),
      domain,
      
      // Ollama
      ollamaResult.success,
      ollamaResult.processingTime,
      ollamaResult.parsingMethod,
      ollamaResult.recipe?.title || '',
      ollamaResult.recipe?.ingredients?.length || 0,
      !!ollamaResult.recipe?.instructions,
      ollamaResult.error || '',
      
      // Traditional
      traditionalResult.success,
      traditionalResult.processingTime,
      traditionalResult.parsingMethod,
      traditionalResult.recipe?.title || '',
      traditionalResult.recipe?.ingredients?.length || 0,
      !!traditionalResult.recipe?.instructions,
      traditionalResult.error || '',
      
      // Evaluations
      ollamaEval?.titleAccurate ?? '',
      ollamaEval?.ingredientsAccurate ?? '',
      ollamaEval?.instructionsAccurate ?? '',
      ollamaEval?.overallSuccess ?? '',
      traditionalEval?.titleAccurate ?? '',
      traditionalEval?.ingredientsAccurate ?? '',
      traditionalEval?.instructionsAccurate ?? '',
      traditionalEval?.overallSuccess ?? '',
      
      // Performance
      speedWinner,
      accuracyWinner
    ].map(value => {
      // Escape CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

/**
 * Format comparison data for detailed JSON export
 */
function formatForJSON(comparisons: any[]) {
  return {
    exportedAt: new Date().toISOString(),
    totalComparisons: comparisons.length,
    data: comparisons.map(comparison => ({
      id: comparison.id,
      url: comparison.url,
      domain: new URL(comparison.url).hostname,
      timestamp: comparison.timestamp.toISOString(),
      status: comparison.status,
      notes: comparison.notes,
      
      results: {
        ollama: {
          success: comparison.ollamaResult.success,
          processingTime: comparison.ollamaResult.processingTime,
          parsingMethod: comparison.ollamaResult.parsingMethod,
          recipe: comparison.ollamaResult.recipe,
          error: comparison.ollamaResult.error
        },
        traditional: {
          success: comparison.traditionalResult.success,
          processingTime: comparison.traditionalResult.processingTime,
          parsingMethod: comparison.traditionalResult.parsingMethod,
          recipe: comparison.traditionalResult.recipe,
          error: comparison.traditionalResult.error
        }
      },
      
      evaluations: comparison.evaluations || {},
      
      analysis: {
        speedWinner: comparison.ollamaResult.processingTime < comparison.traditionalResult.processingTime ? 'ollama' : 'traditional',
        bothSuccessful: comparison.ollamaResult.success && comparison.traditionalResult.success,
        bothFailed: !comparison.ollamaResult.success && !comparison.traditionalResult.success,
        speedDifference: Math.abs(comparison.ollamaResult.processingTime - comparison.traditionalResult.processingTime)
      }
    })),
    
    summary: {
      ollamaSuccessRate: (comparisons.filter(c => c.ollamaResult.success).length / comparisons.length) * 100,
      traditionalSuccessRate: (comparisons.filter(c => c.traditionalResult.success).length / comparisons.length) * 100,
      averageOllamaTime: comparisons.reduce((sum, c) => sum + c.ollamaResult.processingTime, 0) / comparisons.length,
      averageTraditionalTime: comparisons.reduce((sum, c) => sum + c.traditionalResult.processingTime, 0) / comparisons.length,
      bothSuccessfulRate: (comparisons.filter(c => c.ollamaResult.success && c.traditionalResult.success).length / comparisons.length) * 100,
      bothFailedRate: (comparisons.filter(c => !c.ollamaResult.success && !c.traditionalResult.success).length / comparisons.length) * 100
    }
  }
}

/**
 * GET /api/recipes/import-comparison/export
 * Export comparison data for analysis
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json' // json, csv
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const status = searchParams.get('status') // pending, evaluated, archived
    
    // Validate parameters
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json({
        error: 'Invalid format. Use "json" or "csv".'
      }, { status: 400 })
    }

    if (limit > 1000) {
      return NextResponse.json({
        error: 'Limit cannot exceed 1000 records.'
      }, { status: 400 })
    }

    // Fetch comparison data
    const comparisons = await getRecentComparisons(limit)
    
    // Filter by status if specified
    const filteredComparisons = status 
      ? comparisons.filter((c: any) => c.status === status)
      : comparisons

    if (filteredComparisons.length === 0) {
      return NextResponse.json({
        error: 'No comparison data found matching the criteria.'
      }, { status: 404 })
    }

    // Format and return data based on requested format
    if (format === 'csv') {
      const csvData = formatForCSV(filteredComparisons)
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="recipe-comparison-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      const jsonData = formatForJSON(filteredComparisons)
      
      return NextResponse.json(jsonData, {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="recipe-comparison-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    }

  } catch (error) {
    console.error('Export failed:', error)
    
    return NextResponse.json({
      error: `Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

/**
 * GET /api/recipes/import-comparison/export/stats
 * Export aggregated statistics for analysis
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const { days = 30, includeTrends = false } = body
    
    // Import performance metrics functions
    const { generateComparisonSummary, getPerformanceTrends } = await import('@/lib/performance-metrics')
    
    // Generate summary
    const summary = await generateComparisonSummary()
    if (!summary) {
      return NextResponse.json({
        error: 'No data available for statistics export.'
      }, { status: 404 })
    }

    let trends = null
    if (includeTrends) {
      const [ollamaTrends, traditionalTrends] = await Promise.all([
        getPerformanceTrends('ollama', days),
        getPerformanceTrends('traditional', days)
      ])
      trends = { ollama: ollamaTrends, traditional: traditionalTrends }
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      period: `Last ${days} days`,
      summary,
      trends,
      recommendations: {
        currentLeader: summary.recommendedTechnology,
        performanceInsights: [
          summary.performanceWinner === 'ollama' ? 'Ollama is faster on average' : 'Traditional parsing is faster on average',
          summary.accuracyWinner === 'ollama' ? 'Ollama is more accurate' : 'Traditional parsing is more accurate',
          summary.totalComparisons < 50 ? 'More data needed for reliable conclusions' : 'Sufficient data for analysis'
        ],
        nextSteps: [
          summary.pendingEvaluations > 0 ? `${summary.pendingEvaluations} comparisons need manual evaluation` : 'All comparisons have been evaluated',
          summary.recommendedTechnology === 'inconclusive' ? 'Continue testing to determine clear winner' : `Consider adopting ${summary.recommendedTechnology} approach`
        ]
      }
    }

    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="recipe-comparison-stats-${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('Statistics export failed:', error)
    
    return NextResponse.json({
      error: `Failed to export statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
} 