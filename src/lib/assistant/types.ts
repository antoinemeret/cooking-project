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
  'cuisineStyle',
  'maxPrepTime',
  'maxCookTime',
  'cookingMethod',
  'servings',
  'mealContext'
])

export type ConstraintType = z.infer<typeof ConstraintTypeSchema>

// Valid values for each constraint type
export const DishTypeSchema = z.enum([
  'appetizer',
  'main',
  'dessert',
  'side',
  'salad',
  'soup',
  'pasta',
  'pizza',
  'sandwich',
  'breakfast',
  'lunch',
  'dinner',
  'snack'
])

export const DietaryRestrictionsSchema = z.enum([
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'soy-free',
  'keto',
  'paleo',
  'low-carb',
  'low-fat',
  'high-protein',
  'halal',
  'kosher'
])

export const CuisineStyleSchema = z.enum([
  'italian',
  'french',
  'mexican',
  'chinese',
  'japanese',
  'indian',
  'thai',
  'lebanese',
  'mediterranean',
  'american',
  'greek',
  'spanish',
  'german',
  'korean'
])

export const CookingMethodSchema = z.enum([
  'oven',
  'stovetop',
  'grill',
  'raw',
  'steam',
  'fry',
  'bake',
  'roast',
  'boil',
  'sauté',
  'slow-cook',
  'pressure-cook'
])

export const MealContextSchema = z.enum([
  'quick-dinner',
  'dinner-party',
  'meal-prep',
  'weekend-cooking',
  'comfort-food',
  'healthy',
  'indulgent',
  'family-friendly',
  'romantic',
  'casual'
])

// General constraints (apply to all meals)
export const GeneralConstraintsSchema = z.object({
  mealCount: z.number().int().min(1).max(7).default(1),
  seasonal: z.boolean().default(true)
})

// Per-meal constraints
export const PerMealConstraintsSchema = z.object({
  mealIndex: z.number().int().min(0),
  includeIngredients: z.array(z.string().min(1)).optional(),
  excludeIngredients: z.array(z.string().min(1)).optional(),
  dishType: z.array(DishTypeSchema).optional(),
  dietaryRestrictions: z.array(DietaryRestrictionsSchema).optional(),
  cuisineStyle: z.array(CuisineStyleSchema).optional(),
  maxPrepTime: z.number().int().min(0).optional(), // in minutes
  maxCookTime: z.number().int().min(0).optional(), // in minutes
  cookingMethod: z.array(CookingMethodSchema).optional(),
  servings: z.number().int().min(1).optional(),
  mealContext: z.array(MealContextSchema).optional()
})

// Full constraints structure
export const ConstraintsSchema = z.object({
  general: GeneralConstraintsSchema,
  perMeal: z.array(PerMealConstraintsSchema),
  conflicts: z.array(z.string()).optional()
})

// Constraint parsing API request
export const ConstraintParseRequestSchema = z.object({
  transcript: z.string().min(1),
  language: z.string().optional().default('fr')
})

// Constraint parsing API response
export const ConstraintParseResponseSchema = z.object({
  constraints: ConstraintsSchema,
  interpretation: z.string(), // Human-readable interpretation
  confidence: z.number().min(0).max(1),
  extractedValues: z.record(z.string(), z.any()).optional(), // Key-value pairs of extracted values
  language: z.string().optional()
})

// Partial interpretation when parsing fails
export const PartialInterpretationSchema = z.object({
  constraints: ConstraintsSchema.partial(),
  interpretation: z.string(),
  confidence: z.number().min(0).max(1),
  extractedValues: z.record(z.string(), z.any()).optional(),
  language: z.string().optional(),
  errors: z.array(z.string()).optional()
})

export type GeneralConstraints = z.infer<typeof GeneralConstraintsSchema>
export type PerMealConstraints = z.infer<typeof PerMealConstraintsSchema>
export type Constraints = z.infer<typeof ConstraintsSchema>
export type ConstraintParseRequest = z.infer<typeof ConstraintParseRequestSchema>
export type ConstraintParseResponse = z.infer<typeof ConstraintParseResponseSchema>
export type PartialInterpretation = z.infer<typeof PartialInterpretationSchema>

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
  interpretation: ConstraintParseResponse | null
  
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
  setInterpretation: (interpretation: ConstraintParseResponse) => void
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
