import { z } from 'zod'

// Assistant flow states
export type AssistantState = 
  | 'idle'
  | 'recording'
  | 'processing'
  | 'interpreting'
  | 'editing'
  | 'suggesting'
  | 'validating'
  | 'completed'

// Constraint types for v1
export const ConstraintTypeSchema = z.enum([
  'mealCount',
  'includeIngredients',
  'excludeIngredients', 
  'dishType',
  'dietaryRestrictions',
  'cuisineStyle'
])

export type ConstraintType = z.infer<typeof ConstraintTypeSchema>

// General constraints (apply to all meals)
export const GeneralConstraintsSchema = z.object({
  mealCount: z.number().min(1).max(7).optional(),
  seasonal: z.boolean().optional()
})

// Per-meal constraints
export const PerMealConstraintsSchema = z.object({
  mealIndex: z.number().min(0),
  includeIngredients: z.array(z.string()).optional(),
  excludeIngredients: z.array(z.string()).optional(),
  dishType: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  cuisineStyle: z.array(z.string()).optional()
})

// Full constraints structure
export const ConstraintsSchema = z.object({
  general: GeneralConstraintsSchema,
  perMeal: z.array(PerMealConstraintsSchema),
  conflicts: z.array(z.string()).optional()
})

export type GeneralConstraints = z.infer<typeof GeneralConstraintsSchema>
export type PerMealConstraints = z.infer<typeof PerMealConstraintsSchema>
export type Constraints = z.infer<typeof ConstraintsSchema>

// Voice transcription result
export const TranscriptionResultSchema = z.object({
  transcript: z.string(),
  confidence: z.number().min(0).max(1)
})

export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>

// Recipe suggestion result
export const RecipeSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  lastCookedAt: z.date().optional(),
  matchPercentage: z.number().min(0).max(100)
})

export type RecipeSuggestion = z.infer<typeof RecipeSuggestionSchema>

// Suggestion sections
export const SuggestionSectionsSchema = z.object({
  perfectMatches: z.array(RecipeSuggestionSchema),
  partialMatches: z.array(RecipeSuggestionSchema),
  hasMore: z.boolean()
})

export type SuggestionSections = z.infer<typeof SuggestionSectionsSchema>

// Selected recipe for a meal
export const SelectedRecipeSchema = z.object({
  mealIndex: z.number(),
  recipe: RecipeSuggestionSchema
})

export type SelectedRecipe = z.infer<typeof SelectedRecipeSchema>

// Assistant store state
export interface AssistantStore {
  // Current state
  currentState: AssistantState
  
  // Voice recording
  isRecording: boolean
  transcriptionResult: TranscriptionResult | null
  
  // Constraints
  constraints: Constraints | null
  
  // Current meal being suggested
  currentMealIndex: number
  
  // Suggestions for current meal
  currentSuggestions: SuggestionSections | null
  
  // Selected recipes
  selectedRecipes: SelectedRecipe[]
  
  // UI state
  isLoading: boolean
  error: string | null
}

// Actions for the store
export interface AssistantActions {
  // State transitions
  setState: (state: AssistantState) => void
  
  // Voice recording
  startRecording: () => void
  stopRecording: () => void
  setTranscriptionResult: (result: TranscriptionResult) => void
  
  // Constraints
  setConstraints: (constraints: Constraints) => void
  updateGeneralConstraints: (constraints: Partial<GeneralConstraints>) => void
  updatePerMealConstraints: (mealIndex: number, constraints: Partial<PerMealConstraints>) => void
  addPerMealConstraints: (constraints: PerMealConstraints) => void
  removePerMealConstraints: (mealIndex: number) => void
  
  // Suggestions
  setCurrentMealIndex: (index: number) => void
  setCurrentSuggestions: (suggestions: SuggestionSections) => void
  
  // Selection
  selectRecipe: (mealIndex: number, recipe: RecipeSuggestion) => void
  removeSelectedRecipe: (mealIndex: number) => void
  clearSelections: () => void
  
  // UI state
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Reset
  reset: () => void
}

// Combined store type
export type AssistantStoreType = AssistantStore & AssistantActions
