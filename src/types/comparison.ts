// Recipe parsing result types
export interface ParsedRecipe {
  title: string | null
  summary: string | null
  instructions: string[] | null
  ingredients: string[] | null
  cookingTime: number | null // in minutes
  servings: number | null
  difficulty: string | null
  cuisine: string | null
  tags: string[]
}

// Parsing technology results
export interface ParsingResult {
  success: boolean
  recipe: ParsedRecipe | null
  error: string | null
  processingTime: number // in milliseconds
  parsingMethod: 'json-ld' | 'microdata' | 'html-parsing' | 'ollama' | 'hybrid' | 'failed'
  extractedRawData?: any // For debugging purposes
}

// Comparison results for both technologies
export interface ComparisonResult {
  id: string
  url: string
  timestamp: Date
  ollamaResult: ParsingResult
  traditionalResult: ParsingResult
  
  // Manual evaluation results
  evaluations?: {
    ollama: RecipeEvaluation
    traditional: RecipeEvaluation
  }
  
  // Overall comparison status
  status: 'pending' | 'evaluated' | 'archived'
  notes?: string
}

// Manual evaluation for each technology
export interface RecipeEvaluation {
  // Manual scoring fields (new)
  titleScore?: number | null  // -1, 0, or 1
  ingredientsScore?: number | null  // -1, 0, or 1
  instructionsScore?: number | null  // -1, 0, or 1
  totalScore?: number | null  // Sum of the three scores above
  
  // Legacy boolean fields (backward compatibility)
  titleAccurate: boolean | null
  ingredientsAccurate: boolean | null
  instructionsAccurate: boolean | null
  overallSuccess: boolean | null
  
  evaluatedAt?: Date
  evaluatorNotes?: string
}

// Performance metrics aggregation
export interface PerformanceMetrics {
  technologyName: 'ollama' | 'traditional'
  totalTests: number
  successfulParses: number
  failedParses: number
  averageProcessingTime: number // in milliseconds
  successRate: number // percentage
  
  // Accuracy breakdown
  titleAccuracyRate: number
  ingredientsAccuracyRate: number
  instructionsAccuracyRate: number
  overallAccuracyRate: number
  
  // Processing time statistics
  fastestParse: number
  slowestParse: number
  medianProcessingTime: number
  
  lastUpdated: Date
}

// Comparison dashboard summary
export interface ComparisonSummary {
  totalComparisons: number
  pendingEvaluations: number
  completedEvaluations: number
  
  ollamaMetrics: PerformanceMetrics
  traditionalMetrics: PerformanceMetrics
  
  // Comparative analysis
  performanceWinner: 'ollama' | 'traditional' | 'tie'
  accuracyWinner: 'ollama' | 'traditional' | 'tie'
  recommendedTechnology: 'ollama' | 'traditional' | 'inconclusive'
  
  generatedAt: Date
}

// API request/response types
export interface ImportComparisonRequest {
  url: string
  timeout?: number // in milliseconds, default 30000
}

export interface ImportComparisonResponse {
  success: boolean
  comparisonId: string
  results: {
    ollama: ParsingResult
    traditional: ParsingResult
  }
  error?: string
}

export interface EvaluationSubmissionRequest {
  comparisonId: string
  technology: 'ollama' | 'traditional'
  evaluation: Omit<RecipeEvaluation, 'evaluatedAt'>
}

export interface EvaluationSubmissionResponse {
  success: boolean
  comparisonId: string
  updatedEvaluation: RecipeEvaluation
  error?: string
}

// Database storage types (for Prisma schema extension)
export interface ComparisonResultRecord {
  id: string
  url: string
  timestamp: Date
  ollamaResult: string // JSON stringified ParsingResult
  traditionalResult: string // JSON stringified ParsingResult
  ollamaEvaluation: string | null // JSON stringified RecipeEvaluation
  traditionalEvaluation: string | null // JSON stringified RecipeEvaluation
  status: 'pending' | 'evaluated' | 'archived'
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

// UI component props types
export interface ComparisonInterfaceProps {
  onComparisonSubmit: (url: string) => void
  loading: boolean
  error: string | null
}

export interface ComparisonResultsProps {
  comparison: ComparisonResult | null
  onEvaluationSubmit: (technology: 'ollama' | 'traditional', evaluation: Omit<RecipeEvaluation, 'evaluatedAt'>) => void
  evaluationLoading: boolean
}

export interface MetricsDashboardProps {
  summary: ComparisonSummary
  recentComparisons: ComparisonResult[]
  onRefresh: () => void
}

// Utility types for parsing
export type ParsingTechnology = 'ollama' | 'traditional'
export type ParsingMethod = 'json-ld' | 'microdata' | 'html-parsing' | 'ollama' | 'hybrid' | 'failed'
export type EvaluationField = 'titleAccurate' | 'ingredientsAccurate' | 'instructionsAccurate' | 'overallSuccess'
export type ComparisonStatus = 'pending' | 'evaluated' | 'archived'

// Error types
export interface ParsingError {
  code: 'TIMEOUT' | 'NETWORK_ERROR' | 'PARSING_FAILED' | 'INVALID_URL' | 'UNKNOWN_ERROR'
  message: string
  details?: any
}

// Test dataset types
export interface TestUrl {
  url: string
  expectedRecipe: Partial<ParsedRecipe>
  websiteName: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasStructuredData: boolean
  notes?: string
}

export interface TestDataset {
  name: string
  description: string
  urls: TestUrl[]
  createdAt: Date
  updatedAt: Date
} 