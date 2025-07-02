import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  EvaluationSubmissionRequest, 
  EvaluationSubmissionResponse,
  RecipeEvaluation
} from '@/types/comparison'

/**
 * Validate evaluation submission request
 */
function validateEvaluationRequest(body: any): EvaluationSubmissionRequest | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const { comparisonId, technology, evaluation } = body

  if (!comparisonId || typeof comparisonId !== 'string') {
    return null
  }

  if (!technology || !['ollama', 'traditional'].includes(technology)) {
    return null
  }

  if (!evaluation || typeof evaluation !== 'object') {
    return null
  }

  // Validate evaluation fields (booleans for legacy, integers for manual scoring)
  const validEvaluation = {
    // Manual scoring fields (integers: -1, 0, 1)
    titleScore: typeof evaluation.titleScore === 'number' && [-1, 0, 1].includes(evaluation.titleScore) ? evaluation.titleScore : undefined,
    ingredientsScore: typeof evaluation.ingredientsScore === 'number' && [-1, 0, 1].includes(evaluation.ingredientsScore) ? evaluation.ingredientsScore : undefined,
    instructionsScore: typeof evaluation.instructionsScore === 'number' && [-1, 0, 1].includes(evaluation.instructionsScore) ? evaluation.instructionsScore : undefined,
    
    // Legacy boolean fields
    titleAccurate: typeof evaluation.titleAccurate === 'boolean' ? evaluation.titleAccurate : null,
    ingredientsAccurate: typeof evaluation.ingredientsAccurate === 'boolean' ? evaluation.ingredientsAccurate : null,
    instructionsAccurate: typeof evaluation.instructionsAccurate === 'boolean' ? evaluation.instructionsAccurate : null,
    overallSuccess: typeof evaluation.overallSuccess === 'boolean' ? evaluation.overallSuccess : null,
    evaluatorNotes: typeof evaluation.evaluatorNotes === 'string' ? evaluation.evaluatorNotes : undefined
  }

  return {
    comparisonId,
    technology,
    evaluation: validEvaluation
  }
}

/**
 * Update comparison status based on evaluations
 */
async function updateComparisonStatus(comparisonId: string): Promise<void> {
  try {
    // Check if both technologies have been evaluated
    const evaluations = await prisma.comparisonEvaluation.findMany({
      where: { comparisonId }
    })

    if (evaluations.length >= 2) {
      // Both technologies evaluated, mark as completed
      await prisma.comparisonResult.update({
        where: { id: comparisonId },
        data: { status: 'evaluated' }
      })
    }
  } catch (error) {
    console.error('Failed to update comparison status:', error)
    // Don't throw - this is a nice-to-have feature
  }
}

/**
 * POST /api/recipes/import-comparison/evaluate
 * Submit manual evaluation for a comparison result
 */
export async function POST(req: NextRequest): Promise<NextResponse<EvaluationSubmissionResponse>> {
  try {
    // Parse and validate request
    const body = await req.json()
    const validatedRequest = validateEvaluationRequest(body)

    if (!validatedRequest) {
      return NextResponse.json({
        success: false,
        comparisonId: body?.comparisonId || 'unknown',
        updatedEvaluation: {} as RecipeEvaluation,
        error: 'Invalid request: missing or invalid comparisonId, technology, or evaluation data'
      }, { status: 400 })
    }

    const { comparisonId, technology, evaluation } = validatedRequest

    // Verify the comparison exists
    const comparisonExists = await prisma.comparisonResult.findUnique({
      where: { id: comparisonId }
    })

    if (!comparisonExists) {
      return NextResponse.json({
        success: false,
        comparisonId,
        updatedEvaluation: {} as RecipeEvaluation,
        error: 'Comparison not found'
      }, { status: 404 })
    }

    // Prepare update data for manual scoring
    const updateData: any = {
      evaluatedAt: new Date()
    }
    const createData: any = {
      comparisonId,
      technology,
      evaluatedAt: new Date()
    }

    // Handle manual scoring fields
    if (evaluation.titleScore !== undefined) {
      updateData.titleScore = evaluation.titleScore
      createData.titleScore = evaluation.titleScore
      // Convert to boolean for backward compatibility
      updateData.titleAccurate = evaluation.titleScore === 1 ? true : evaluation.titleScore === -1 ? false : null
      createData.titleAccurate = evaluation.titleScore === 1 ? true : evaluation.titleScore === -1 ? false : null
    }
    if (evaluation.ingredientsScore !== undefined) {
      updateData.ingredientsScore = evaluation.ingredientsScore
      createData.ingredientsScore = evaluation.ingredientsScore
      updateData.ingredientsAccurate = evaluation.ingredientsScore === 1 ? true : evaluation.ingredientsScore === -1 ? false : null
      createData.ingredientsAccurate = evaluation.ingredientsScore === 1 ? true : evaluation.ingredientsScore === -1 ? false : null
    }
    if (evaluation.instructionsScore !== undefined) {
      updateData.instructionsScore = evaluation.instructionsScore
      createData.instructionsScore = evaluation.instructionsScore
      updateData.instructionsAccurate = evaluation.instructionsScore === 1 ? true : evaluation.instructionsScore === -1 ? false : null
      createData.instructionsAccurate = evaluation.instructionsScore === 1 ? true : evaluation.instructionsScore === -1 ? false : null
    }

    // Handle legacy boolean fields
    if (evaluation.titleAccurate !== undefined) {
      updateData.titleAccurate = evaluation.titleAccurate
      createData.titleAccurate = evaluation.titleAccurate
    }
    if (evaluation.ingredientsAccurate !== undefined) {
      updateData.ingredientsAccurate = evaluation.ingredientsAccurate
      createData.ingredientsAccurate = evaluation.ingredientsAccurate
    }
    if (evaluation.instructionsAccurate !== undefined) {
      updateData.instructionsAccurate = evaluation.instructionsAccurate
      createData.instructionsAccurate = evaluation.instructionsAccurate
    }
    if (evaluation.overallSuccess !== undefined) {
      updateData.overallSuccess = evaluation.overallSuccess
      createData.overallSuccess = evaluation.overallSuccess
    }
    if (evaluation.evaluatorNotes !== undefined) {
      updateData.evaluatorNotes = evaluation.evaluatorNotes
      createData.evaluatorNotes = evaluation.evaluatorNotes
    }

    // Get current evaluation to calculate total score
    const currentEvaluation = await prisma.comparisonEvaluation.findUnique({
      where: {
        comparisonId_technology: {
          comparisonId,
          technology
        }
      }
    })

    // Calculate total score if we have all three scores
    const titleScore = updateData.titleScore !== undefined ? updateData.titleScore : currentEvaluation?.titleScore
    const ingredientsScore = updateData.ingredientsScore !== undefined ? updateData.ingredientsScore : currentEvaluation?.ingredientsScore
    const instructionsScore = updateData.instructionsScore !== undefined ? updateData.instructionsScore : currentEvaluation?.instructionsScore

    if (titleScore !== null && ingredientsScore !== null && instructionsScore !== null) {
      updateData.totalScore = titleScore + ingredientsScore + instructionsScore
      createData.totalScore = titleScore + ingredientsScore + instructionsScore
    }

    // Upsert the evaluation (create or update)
    const savedEvaluation = await prisma.comparisonEvaluation.upsert({
      where: {
        comparisonId_technology: {
          comparisonId,
          technology
        }
      },
      update: updateData,
      create: createData
    })

    // Update comparison status if both technologies are now evaluated
    await updateComparisonStatus(comparisonId)

    // Format response
    const updatedEvaluation: RecipeEvaluation = {
      // Manual scoring fields
      titleScore: savedEvaluation.titleScore,
      ingredientsScore: savedEvaluation.ingredientsScore,
      instructionsScore: savedEvaluation.instructionsScore,
      totalScore: savedEvaluation.totalScore,
      
      // Legacy boolean fields
      titleAccurate: savedEvaluation.titleAccurate,
      ingredientsAccurate: savedEvaluation.ingredientsAccurate,
      instructionsAccurate: savedEvaluation.instructionsAccurate,
      overallSuccess: savedEvaluation.overallSuccess,
      
      evaluatedAt: savedEvaluation.evaluatedAt,
      evaluatorNotes: savedEvaluation.evaluatorNotes || undefined
    }

    return NextResponse.json({
      success: true,
      comparisonId,
      updatedEvaluation,
    }, { status: 200 })

  } catch (error) {
    console.error('Evaluation submission failed:', error)
    
    return NextResponse.json({
      success: false,
      comparisonId: 'unknown',
      updatedEvaluation: {} as RecipeEvaluation,
      error: `Failed to save evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

/**
 * GET /api/recipes/import-comparison/evaluate?comparisonId=xxx
 * Retrieve evaluations for a specific comparison
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const comparisonId = searchParams.get('comparisonId')

    if (!comparisonId) {
      return NextResponse.json({
        error: 'Missing comparisonId parameter'
      }, { status: 400 })
    }

    // Fetch evaluations for the comparison
    const evaluations = await prisma.comparisonEvaluation.findMany({
      where: { comparisonId },
      orderBy: { evaluatedAt: 'desc' }
    })

    // Format evaluations by technology
    const evaluationsByTechnology = evaluations.reduce((acc: Record<string, RecipeEvaluation>, evaluation: any) => {
      acc[evaluation.technology] = {
        // Manual scoring fields
        titleScore: evaluation.titleScore,
        ingredientsScore: evaluation.ingredientsScore,
        instructionsScore: evaluation.instructionsScore,
        totalScore: evaluation.totalScore,
        
        // Legacy boolean fields
        titleAccurate: evaluation.titleAccurate,
        ingredientsAccurate: evaluation.ingredientsAccurate,
        instructionsAccurate: evaluation.instructionsAccurate,
        overallSuccess: evaluation.overallSuccess,
        
        evaluatedAt: evaluation.evaluatedAt,
        evaluatorNotes: evaluation.evaluatorNotes || undefined
      }
      return acc
    }, {} as Record<string, RecipeEvaluation>)

    return NextResponse.json({
      success: true,
      comparisonId,
      evaluations: evaluationsByTechnology
    }, { status: 200 })

  } catch (error) {
    console.error('Failed to fetch evaluations:', error)
    
    return NextResponse.json({
      error: `Failed to fetch evaluations: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
} 