import { prisma } from '@/lib/prisma'

/**
 * Data cleanup utilities for managing comparison test data
 */

interface CleanupOptions {
  dryRun?: boolean
  olderThanDays?: number
  status?: 'pending' | 'evaluated' | 'archived'
  maxRecords?: number
}

interface CleanupResult {
  deletedComparisons: number
  deletedEvaluations: number
  resetMetrics: boolean
  errors: string[]
}

/**
 * Clean up old comparison results
 */
export async function cleanupOldComparisons(options: CleanupOptions = {}): Promise<CleanupResult> {
  const {
    dryRun = false,
    olderThanDays = 90,
    status,
    maxRecords
  } = options

  const result: CleanupResult = {
    deletedComparisons: 0,
    deletedEvaluations: 0,
    resetMetrics: false,
    errors: []
  }

  try {
    // Build where clause
    const whereClause: any = {}
    
    if (olderThanDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
      whereClause.timestamp = { lt: cutoffDate }
    }
    
    if (status) {
      whereClause.status = status
    }

    // Find comparisons to delete
    const comparisonsToDelete = await (prisma as any).comparisonResult.findMany({
      where: whereClause,
      select: { id: true },
      orderBy: { timestamp: 'asc' },
      take: maxRecords
    })

    if (comparisonsToDelete.length === 0) {
      console.log('No comparison results found matching cleanup criteria')
      return result
    }

    const comparisonIds = comparisonsToDelete.map((c: any) => c.id)
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${comparisonIds.length} comparison results`)
      result.deletedComparisons = comparisonIds.length
      
      // Count evaluations that would be deleted
      const evaluationCount = await (prisma as any).comparisonEvaluation.count({
        where: { comparisonId: { in: comparisonIds } }
      })
      result.deletedEvaluations = evaluationCount
      
      return result
    }

    // Delete evaluations first (foreign key constraint)
    const deletedEvaluations = await (prisma as any).comparisonEvaluation.deleteMany({
      where: { comparisonId: { in: comparisonIds } }
    })

    // Delete comparison results
    const deletedComparisons = await (prisma as any).comparisonResult.deleteMany({
      where: { id: { in: comparisonIds } }
    })

    result.deletedComparisons = deletedComparisons.count
    result.deletedEvaluations = deletedEvaluations.count

    console.log(`Cleaned up ${result.deletedComparisons} comparison results and ${result.deletedEvaluations} evaluations`)

  } catch (error) {
    const errorMessage = `Failed to cleanup old comparisons: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(errorMessage)
  }

  return result
}

/**
 * Clean up test data by URL patterns
 */
export async function cleanupTestUrls(patterns: string[], dryRun: boolean = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedComparisons: 0,
    deletedEvaluations: 0,
    resetMetrics: false,
    errors: []
  }

  try {
    const orConditions = patterns.map(pattern => ({
      url: { contains: pattern }
    }))

    const whereClause = {
      OR: orConditions
    }

    // Find comparisons matching test URL patterns
    const testComparisons = await (prisma as any).comparisonResult.findMany({
      where: whereClause,
      select: { id: true, url: true }
    })

    if (testComparisons.length === 0) {
      console.log('No test URLs found matching the specified patterns')
      return result
    }

    const comparisonIds = testComparisons.map((c: any) => c.id)
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${comparisonIds.length} test comparisons:`)
      testComparisons.forEach((c: any) => console.log(`  - ${c.url}`))
      result.deletedComparisons = comparisonIds.length
      
      const evaluationCount = await (prisma as any).comparisonEvaluation.count({
        where: { comparisonId: { in: comparisonIds } }
      })
      result.deletedEvaluations = evaluationCount
      
      return result
    }

    // Delete evaluations first
    const deletedEvaluations = await (prisma as any).comparisonEvaluation.deleteMany({
      where: { comparisonId: { in: comparisonIds } }
    })

    // Delete comparison results
    const deletedComparisons = await (prisma as any).comparisonResult.deleteMany({
      where: { id: { in: comparisonIds } }
    })

    result.deletedComparisons = deletedComparisons.count
    result.deletedEvaluations = deletedEvaluations.count

    console.log(`Cleaned up ${result.deletedComparisons} test comparison results`)

  } catch (error) {
    const errorMessage = `Failed to cleanup test URLs: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(errorMessage)
  }

  return result
}

/**
 * Archive old comparison results instead of deleting them
 */
export async function archiveOldComparisons(olderThanDays: number = 60, dryRun: boolean = false): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const whereClause = {
      timestamp: { lt: cutoffDate },
      status: { not: 'archived' }
    }

    if (dryRun) {
      const count = await (prisma as any).comparisonResult.count({ where: whereClause })
      console.log(`[DRY RUN] Would archive ${count} comparison results`)
      return count
    }

    const result = await (prisma as any).comparisonResult.updateMany({
      where: whereClause,
      data: { status: 'archived' }
    })

    console.log(`Archived ${result.count} old comparison results`)
    return result.count

  } catch (error) {
    console.error('Failed to archive old comparisons:', error)
    return 0
  }
}

/**
 * Reset performance metrics (useful after data cleanup)
 */
export async function resetPerformanceMetrics(dryRun: boolean = false): Promise<boolean> {
  try {
    if (dryRun) {
      console.log('[DRY RUN] Would reset all performance metrics')
      return true
    }

    await (prisma as any).performanceMetrics.deleteMany()
    console.log('Performance metrics reset successfully')
    return true

  } catch (error) {
    console.error('Failed to reset performance metrics:', error)
    return false
  }
}

/**
 * Get data cleanup recommendations
 */
export async function getCleanupRecommendations() {
  try {
    const totalComparisons = await (prisma as any).comparisonResult.count()
    const archivedCount = await (prisma as any).comparisonResult.count({
      where: { status: 'archived' }
    })
    const pendingCount = await (prisma as any).comparisonResult.count({
      where: { status: 'pending' }
    })

    // Count old comparisons (older than 90 days)
    const oldCutoff = new Date()
    oldCutoff.setDate(oldCutoff.getDate() - 90)
    const oldCount = await (prisma as any).comparisonResult.count({
      where: { timestamp: { lt: oldCutoff } }
    })

    // Count test URLs (common test patterns)
    const testPatterns = ['localhost', 'example.com', 'test.', '.test', 'staging.', 'dev.']
    const testUrlCount = await (prisma as any).comparisonResult.count({
      where: {
        OR: testPatterns.map(pattern => ({ url: { contains: pattern } }))
      }
    })

    return {
      totalComparisons,
      archivedCount,
      pendingCount,
      oldCount,
      testUrlCount,
      recommendations: [
        oldCount > 50 ? `Consider archiving ${oldCount} comparisons older than 90 days` : null,
        testUrlCount > 0 ? `Found ${testUrlCount} test URLs that could be cleaned up` : null,
        pendingCount > 100 ? `${pendingCount} comparisons are pending evaluation` : null,
        totalComparisons > 1000 ? 'Database has large amount of data, consider regular cleanup' : null
      ].filter((item) => item !== null)
    }

  } catch (error) {
    console.error('Failed to get cleanup recommendations:', error)
    return null
  }
}

/**
 * Comprehensive cleanup function
 */
export async function performComprehensiveCleanup(options: {
  archiveOlderThanDays?: number
  deleteArchivedOlderThanDays?: number
  cleanupTestUrls?: boolean
  resetMetrics?: boolean
  dryRun?: boolean
} = {}): Promise<CleanupResult> {
  const {
    archiveOlderThanDays = 60,
    deleteArchivedOlderThanDays = 180,
    cleanupTestUrls = false,
    resetMetrics = false,
    dryRun = false
  } = options

  const result: CleanupResult = {
    deletedComparisons: 0,
    deletedEvaluations: 0,
    resetMetrics: false,
    errors: []
  }

  try {
    console.log('Starting comprehensive cleanup...')

    // Step 1: Archive old comparisons
    const archivedCount = await archiveOldComparisons(archiveOlderThanDays, dryRun)
    console.log(`Step 1: Archived ${archivedCount} old comparisons`)

    // Step 2: Delete very old archived comparisons
    const deleteResult = await cleanupOldComparisons({
      dryRun,
      olderThanDays: deleteArchivedOlderThanDays,
      status: 'archived'
    })
    result.deletedComparisons += deleteResult.deletedComparisons
    result.deletedEvaluations += deleteResult.deletedEvaluations
    result.errors.push(...deleteResult.errors)

    // Step 3: Clean up test URLs if requested
    if (cleanupTestUrls) {
      const testPatterns = ['localhost', 'example.com', 'test.', '.test', 'staging.', 'dev.']
      const testCleanup = await cleanupTestUrls(testPatterns, dryRun)
      result.deletedComparisons += testCleanup.deletedComparisons
      result.deletedEvaluations += testCleanup.deletedEvaluations
      result.errors.push(...testCleanup.errors)
    }

    // Step 4: Reset metrics if requested
    if (resetMetrics) {
      result.resetMetrics = await resetPerformanceMetrics(dryRun)
    }

    console.log('Comprehensive cleanup completed successfully')

  } catch (error) {
    const errorMessage = `Comprehensive cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(errorMessage)
  }

  return result
} 