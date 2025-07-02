/**
 * Evaluation Criteria for Recipe Parsing Quality Assessment
 * 
 * This module defines standardized criteria for manually evaluating
 * the quality and accuracy of recipe extraction results from both
 * Ollama and Traditional parsing approaches.
 */

export interface EvaluationCriteria {
  field: 'title' | 'ingredients' | 'instructions' | 'overall'
  weight: number
  description: string
  scoringGuidelines: ScoringGuideline[]
}

export interface ScoringGuideline {
  score: boolean | null  // true = accurate, false = inaccurate, null = partial/unclear
  description: string
  examples: string[]
  commonIssues?: string[]
}

export interface QualityScore {
  field: 'title' | 'ingredients' | 'instructions' | 'overall'
  score: boolean | null
  confidence: 'high' | 'medium' | 'low'
  notes?: string
  specificIssues?: string[]
}

/**
 * Comprehensive evaluation criteria for each recipe field
 */
export const EVALUATION_CRITERIA: Record<string, EvaluationCriteria> = {
  title: {
    field: 'title',
    weight: 0.25,
    description: 'Accuracy of recipe title extraction',
    scoringGuidelines: [
      {
        score: true,
        description: 'Title is completely accurate and matches the original',
        examples: [
          'Exact match: "Classic Chocolate Chip Cookies"',
          'Minor formatting differences: "classic chocolate chip cookies" vs "Classic Chocolate Chip Cookies"',
          'Acceptable variations: "Best Chocolate Chip Cookies" vs "The Best Chocolate Chip Cookies"'
        ]
      },
      {
        score: null,
        description: 'Title is partially correct but has minor issues',
        examples: [
          'Missing descriptors: "Chocolate Chip Cookies" vs "Best Ever Chocolate Chip Cookies"',
          'Extra words: "Easy Classic Chocolate Chip Cookies Recipe" vs "Classic Chocolate Chip Cookies"',
          'Minor spelling errors or formatting issues'
        ],
        commonIssues: [
          'Recipe card title vs page title confusion',
          'Inclusion of cooking time or difficulty in title',
          'HTML entities not properly decoded'
        ]
      },
      {
        score: false,
        description: 'Title is incorrect, missing, or completely inaccurate',
        examples: [
          'Wrong recipe: "Chocolate Cake" when should be "Chocolate Chip Cookies"',
          'Generic titles: "Recipe" or "Delicious Food"',
          'Website name instead of recipe title',
          'No title extracted at all'
        ],
        commonIssues: [
          'Extracted page title instead of recipe title',
          'Parsing failed completely',
          'Wrong section of page parsed'
        ]
      }
    ]
  },

  ingredients: {
    field: 'ingredients',
    weight: 0.40,
    description: 'Accuracy and completeness of ingredients list extraction',
    scoringGuidelines: [
      {
        score: true,
        description: 'All ingredients extracted accurately with proper quantities and formatting',
        examples: [
          'Complete match: ["2 cups flour", "1 tsp salt", "1/2 cup butter"]',
          'Minor formatting: "2 cups all-purpose flour" vs "2 cups flour, all-purpose"',
          'Acceptable quantity variations: "1 teaspoon" vs "1 tsp"'
        ]
      },
      {
        score: null,
        description: 'Most ingredients correct but some issues with quantities, formatting, or minor omissions',
        examples: [
          'Missing quantities: "flour" instead of "2 cups flour"',
          'Extra details: "2 cups flour, sifted and measured" vs "2 cups flour"',
          'Minor ingredient missing: 90% of ingredients present',
          'Slight formatting issues but meaning clear'
        ],
        commonIssues: [
          'Measurements separated from ingredients',
          'Optional ingredients marked inconsistently',
          'Sub-recipe ingredients mixed with main ingredients',
          'Units not standardized'
        ]
      },
      {
        score: false,
        description: 'Major errors in ingredients extraction',
        examples: [
          'Missing major ingredients (50%+ missing)',
          'Wrong ingredients from different recipe',
          'Ingredients list contains non-food items',
          'No ingredients extracted at all',
          'Completely mangled text'
        ],
        commonIssues: [
          'Parsed shopping tips instead of ingredients',
          'Extracted equipment list instead of ingredients',
          'Mixed up with nutrition information',
          'Parsing completely failed'
        ]
      }
    ]
  },

  instructions: {
    field: 'instructions',
    weight: 0.25,
    description: 'Accuracy and completeness of cooking instructions extraction',
    scoringGuidelines: [
      {
        score: true,
        description: 'Instructions are complete, accurate, and properly formatted',
        examples: [
          'Complete step-by-step process captured',
          'Proper sequence maintained',
          'All cooking temperatures and times included',
          'Clear and readable formatting'
        ]
      },
      {
        score: null,
        description: 'Instructions mostly correct but some formatting issues or minor omissions',
        examples: [
          'Steps combined or separated differently but content complete',
          'Minor details missing (exact temperatures, times)',
          'Formatting issues but meaning clear',
          'Some repetition or redundant information'
        ],
        commonIssues: [
          'Steps numbered differently than original',
          'Tips and notes mixed with instructions',
          'Formatting artifacts from HTML conversion',
          'Missing final serving suggestions'
        ]
      },
      {
        score: false,
        description: 'Instructions are incomplete, incorrect, or missing',
        examples: [
          'Major steps missing (50%+ of process)',
          'Instructions from wrong recipe',
          'Only prep notes, no cooking instructions',
          'Unintelligible or mangled text',
          'No instructions extracted'
        ],
        commonIssues: [
          'Extracted recipe description instead of instructions',
          'Mixed with comments or reviews',
          'Parsing failed to find instruction section',
          'Got equipment list instead of steps'
        ]
      }
    ]
  },

  overall: {
    field: 'overall',
    weight: 0.10,
    description: 'Overall success of recipe extraction for practical use',
    scoringGuidelines: [
      {
        score: true,
        description: 'Recipe is complete and usable for cooking',
        examples: [
          'Someone could successfully cook this recipe with the extracted information',
          'All essential information present and accurate',
          'Minor formatting issues don\'t affect usability'
        ]
      },
      {
        score: null,
        description: 'Recipe is mostly usable but has some gaps or issues',
        examples: [
          'Recipe could be cooked but might need some guesswork',
          'Some information missing but core recipe intact',
          'Formatting makes it slightly harder to follow'
        ]
      },
      {
        score: false,
        description: 'Recipe is not usable for cooking',
        examples: [
          'Too much essential information missing',
          'Major errors that would cause cooking failure',
          'Completely wrong or unintelligible content'
        ]
      }
    ]
  }
}

/**
 * Evaluation confidence levels
 */
export const CONFIDENCE_GUIDELINES = {
  high: {
    description: 'Very clear assessment, obvious success or failure',
    criteria: [
      'Perfect match or complete failure',
      'No ambiguity in evaluation',
      'Clear comparison possible'
    ]
  },
  medium: {
    description: 'Some uncertainty but leaning toward assessment',
    criteria: [
      'Minor formatting differences',
      'Subjective judgment required',
      'Close to boundary between scores'
    ]
  },
  low: {
    description: 'Difficult to assess, requires domain knowledge',
    criteria: [
      'Significant ambiguity in original recipe',
      'Multiple valid interpretations possible',
      'Technical cooking knowledge required'
    ]
  }
}

/**
 * Common evaluation mistakes to avoid
 */
export const EVALUATION_PITFALLS = {
  title: [
    'Don\'t penalize minor capitalization differences',
    'Consider context - blog post title vs recipe title',
    'Don\'t expect exact punctuation matches',
    'Be flexible with article words (the, a, an)'
  ],
  ingredients: [
    'Don\'t expect exact quantity formatting',
    'Consider metric vs imperial conversions',
    'Optional ingredients may be excluded (acceptable)',
    'Brand names may be included or excluded',
    'Sub-recipes ingredients may be listed separately'
  ],
  instructions: [
    'Don\'t expect exact step numbering',
    'Combined or split steps can be acceptable',
    'Tips and notes may be included or separate',
    'Temperature conversions (F/C) are acceptable'
  ],
  overall: [
    'Focus on cooking usability, not perfect formatting',
    'Consider if a novice cook could follow it',
    'Don\'t let minor issues affect overall score if recipe is usable'
  ]
}

/**
 * Calculate weighted overall score
 */
export function calculateOverallScore(scores: QualityScore[]): number {
  let totalWeight = 0
  let weightedScore = 0

  for (const score of scores) {
    const criteria = EVALUATION_CRITERIA[score.field]
    if (criteria && score.score !== null) {
      const numericScore = score.score ? 1 : 0
      weightedScore += numericScore * criteria.weight
      totalWeight += criteria.weight
    }
  }

  return totalWeight > 0 ? weightedScore / totalWeight : 0
}

/**
 * Generate evaluation summary
 */
export function generateEvaluationSummary(scores: QualityScore[]): {
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  recommendation: 'accept' | 'review' | 'reject'
} {
  const overallScore = calculateOverallScore(scores)
  const strengths: string[] = []
  const weaknesses: string[] = []

  scores.forEach(score => {
    if (score.score === true) {
      strengths.push(`${score.field} extraction successful`)
    } else if (score.score === false) {
      weaknesses.push(`${score.field} extraction failed`)
    } else {
      weaknesses.push(`${score.field} extraction needs review`)
    }
  })

  let recommendation: 'accept' | 'review' | 'reject'
  if (overallScore >= 0.8) {
    recommendation = 'accept'
  } else if (overallScore >= 0.5) {
    recommendation = 'review'
  } else {
    recommendation = 'reject'
  }

  return {
    overallScore,
    strengths,
    weaknesses,
    recommendation
  }
}

/**
 * Evaluation templates for common scenarios
 */
export const EVALUATION_TEMPLATES = {
  perfect: {
    title: { score: true, confidence: 'high' as const, notes: 'Title extracted perfectly' },
    ingredients: { score: true, confidence: 'high' as const, notes: 'All ingredients with quantities' },
    instructions: { score: true, confidence: 'high' as const, notes: 'Complete cooking instructions' },
    overall: { score: true, confidence: 'high' as const, notes: 'Recipe fully usable' }
  },
  partial: {
    title: { score: true, confidence: 'high' as const },
    ingredients: { score: null, confidence: 'medium' as const, notes: 'Missing some quantities' },
    instructions: { score: true, confidence: 'high' as const },
    overall: { score: null, confidence: 'medium' as const, notes: 'Mostly usable with minor gaps' }
  },
  failed: {
    title: { score: false, confidence: 'high' as const, notes: 'Wrong or missing title' },
    ingredients: { score: false, confidence: 'high' as const, notes: 'Major ingredients missing' },
    instructions: { score: false, confidence: 'high' as const, notes: 'Instructions incomplete' },
    overall: { score: false, confidence: 'high' as const, notes: 'Recipe not usable' }
  }
} 