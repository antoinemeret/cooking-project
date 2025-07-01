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

  // Validate evaluation fields (all should be boolean or null)
  const validEvaluation = {
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

    // Upsert the evaluation (create or update)
    const savedEvaluation = await prisma.comparisonEvaluation.upsert({
      where: {
        comparisonId_technology: {
          comparisonId,
          technology
        }
      },
      update: {
        titleAccurate: evaluation.titleAccurate,
        ingredientsAccurate: evaluation.ingredientsAccurate,
        instructionsAccurate: evaluation.instructionsAccurate,
        overallSuccess: evaluation.overallSuccess,
        evaluatorNotes: evaluation.evaluatorNotes,
        evaluatedAt: new Date()
      },
      create: {
        comparisonId,
        technology,
        titleAccurate: evaluation.titleAccurate,
        ingredientsAccurate: evaluation.ingredientsAccurate,
        instructionsAccurate: evaluation.instructionsAccurate,
        overallSuccess: evaluation.overallSuccess,
        evaluatorNotes: evaluation.evaluatorNotes,
        evaluatedAt: new Date()
      }
    })

    // Update comparison status if both technologies are now evaluated
    await updateComparisonStatus(comparisonId)

    // Format response
    const updatedEvaluation: RecipeEvaluation = {
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