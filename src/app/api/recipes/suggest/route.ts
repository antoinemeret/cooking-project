import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { 
  PerMealConstraintsSchema, 
  GeneralConstraintsSchema,
  SuggestionSectionsSchema 
} from '@/lib/assistant/types'
import { getCurrentMonth } from '@/lib/recipe-filters'

// Request schema for recipe suggestions
const SuggestRequestSchema = z.object({
  constraints: PerMealConstraintsSchema,
  generalConstraints: GeneralConstraintsSchema.optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(20).default(8)
})

type SuggestRequest = z.infer<typeof SuggestRequestSchema>

// Helper to map constraint types to recipe tags
function mapConstraintToTags (
  dishTypes: string[] = [],
  dietaryRestrictions: string[] = [],
  cuisineStyles: string[] = [],
  cookingMethods: string[] = [],
  mealContexts: string[] = []
): string[] {
  const tags: string[] = []

  // Map dish types
  const dishTypeMap: Record<string, string> = {
    appetizer: 'appetizer',
    main: 'main',
    dessert: 'dessert',
    side: 'side',
    salad: 'salad',
    soup: 'soup',
    pasta: 'pasta',
    pizza: 'pizza',
    sandwich: 'sandwich',
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
    snack: 'snack'
  }

  dishTypes.forEach(type => {
    if (dishTypeMap[type]) tags.push(dishTypeMap[type])
  })

  // Map dietary restrictions directly
  dietaryRestrictions.forEach(restriction => {
    tags.push(restriction)
  })

  // Map cuisine styles
  cuisineStyles.forEach(cuisine => {
    tags.push(cuisine)
  })

  // Map cooking methods
  const methodMap: Record<string, string> = {
    oven: 'baked',
    stovetop: 'stovetop',
    grill: 'grilled',
    raw: 'raw',
    steam: 'steamed',
    fry: 'fried',
    bake: 'baked',
    roast: 'roasted',
    boil: 'boiled',
    sauté: 'sautéed',
    'slow-cook': 'slow-cooked',
    'pressure-cook': 'pressure-cooked'
  }

  cookingMethods.forEach(method => {
    if (methodMap[method]) tags.push(methodMap[method])
  })

  // Map meal contexts
  const contextMap: Record<string, string[]> = {
    'quick-dinner': ['quick', 'dinner'],
    'dinner-party': ['dinner', 'special'],
    'meal-prep': ['meal-prep'],
    'weekend-cooking': ['weekend'],
    'comfort-food': ['comfort-food'],
    healthy: ['healthy'],
    indulgent: ['indulgent'],
    'family-friendly': ['family-friendly'],
    romantic: ['romantic'],
    casual: ['casual']
  }

  mealContexts.forEach(context => {
    const contextTags = contextMap[context]
    if (contextTags) tags.push(...contextTags)
  })

  return tags
}

// Calculate match percentage for a recipe
function calculateMatchPercentage (
  recipe: any,
  constraints: z.infer<typeof PerMealConstraintsSchema>,
  generalConstraints: z.infer<typeof GeneralConstraintsSchema> | undefined,
  currentMonth: number
): number {
  let totalCriteria = 0
  let matchedCriteria = 0

  // Parse recipe tags
  let recipeTags: string[] = []
  try {
    recipeTags = JSON.parse(recipe.tags)
    recipeTags = recipeTags.map((tag: string) => tag.toLowerCase())
  } catch {
    recipeTags = []
  }

  // Parse recipe ingredients
  const recipeIngredientNames = recipe.ingredients
    ? recipe.ingredients.map((ing: any) => ing.name.toLowerCase())
    : []

  // Check seasonality (if requested)
  if (generalConstraints?.seasonal) {
    totalCriteria++
    const { startSeason, endSeason } = recipe
    
    // Check if recipe is in season
    let isInSeason = false
    if (startSeason === endSeason) {
      isInSeason = currentMonth === startSeason
    } else if (startSeason <= endSeason) {
      isInSeason = currentMonth >= startSeason && currentMonth <= endSeason
    } else {
      isInSeason = currentMonth >= startSeason || currentMonth <= endSeason
    }
    
    if (isInSeason) matchedCriteria++
  }

  // Check include ingredients
  if (constraints.includeIngredients && constraints.includeIngredients.length > 0) {
    constraints.includeIngredients.forEach(ingredient => {
      totalCriteria++
      const hasIngredient = recipeIngredientNames.some((recipeName: string) =>
        recipeName.includes(ingredient.toLowerCase())
      )
      if (hasIngredient) matchedCriteria++
    })
  }

  // Check exclude ingredients (must match all to be valid)
  if (constraints.excludeIngredients && constraints.excludeIngredients.length > 0) {
    constraints.excludeIngredients.forEach(ingredient => {
      totalCriteria++
      const hasIngredient = recipeIngredientNames.some((recipeName: string) =>
        recipeName.includes(ingredient.toLowerCase())
      )
      if (!hasIngredient) matchedCriteria++ // Match if ingredient is NOT present
    })
  }

  // Check dish type
  if (constraints.dishType && constraints.dishType.length > 0) {
    totalCriteria++
    const hasDishType = constraints.dishType.some(type =>
      recipeTags.includes(type.toLowerCase())
    )
    if (hasDishType) matchedCriteria++
  }

  // Check dietary restrictions
  if (constraints.dietaryRestrictions && constraints.dietaryRestrictions.length > 0) {
    constraints.dietaryRestrictions.forEach(restriction => {
      totalCriteria++
      const hasRestriction = recipeTags.includes(restriction.toLowerCase())
      if (hasRestriction) matchedCriteria++
    })
  }

  // Check cuisine style
  if (constraints.cuisineStyle && constraints.cuisineStyle.length > 0) {
    totalCriteria++
    const hasCuisine = constraints.cuisineStyle.some(cuisine =>
      recipeTags.includes(cuisine.toLowerCase())
    )
    if (hasCuisine) matchedCriteria++
  }

  // Check cooking method
  if (constraints.cookingMethod && constraints.cookingMethod.length > 0) {
    totalCriteria++
    const methodTags = mapConstraintToTags([], [], [], constraints.cookingMethod, [])
    const hasMethod = methodTags.some(methodTag =>
      recipeTags.includes(methodTag.toLowerCase())
    )
    if (hasMethod) matchedCriteria++
  }

  // Check meal context
  if (constraints.mealContext && constraints.mealContext.length > 0) {
    totalCriteria++
    const contextTags = mapConstraintToTags([], [], [], [], constraints.mealContext)
    const hasContext = contextTags.some(contextTag =>
      recipeTags.includes(contextTag.toLowerCase())
    )
    if (hasContext) matchedCriteria++
  }

  // Check prep time
  if (constraints.maxPrepTime !== undefined && recipe.preparationTime !== null) {
    totalCriteria++
    if (recipe.preparationTime <= constraints.maxPrepTime) matchedCriteria++
  }

  // Check cook time
  if (constraints.maxCookTime !== undefined && recipe.cookingTime !== null) {
    totalCriteria++
    if (recipe.cookingTime <= constraints.maxCookTime) matchedCriteria++
  }

  // Check servings (within ±2 is acceptable)
  if (constraints.servings !== undefined) {
    totalCriteria++
    // Recipe doesn't have servings field in schema yet, skip for now
    // When added, check if servings are within ±2 of requested
  }

  // If no criteria, return 0
  if (totalCriteria === 0) return 0

  // Calculate percentage
  return Math.round((matchedCriteria / totalCriteria) * 100)
}

export async function POST (req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request
    const validation = SuggestRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { constraints, generalConstraints, offset, limit } = validation.data

    // Get current month for seasonality check
    const currentMonth = getCurrentMonth()

    // Build Prisma where clause for hard filters
    const where: any = {}

    // Hard filter: exclude ingredients (must not have these)
    if (constraints.excludeIngredients && constraints.excludeIngredients.length > 0) {
      where.ingredients = {
        none: {
          name: {
            in: constraints.excludeIngredients.map(ing => ing.toLowerCase())
          }
        }
      }
    }

    // Fetch recipes with ingredients relation
    const allRecipes = await prisma.recipe.findMany({
      where,
      include: {
        ingredients: true,
        plannedRecipes: {
          orderBy: {
            addedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Calculate match percentage for each recipe
    const recipesWithScores = allRecipes.map(recipe => {
      const matchPercentage = calculateMatchPercentage(
        recipe,
        constraints,
        generalConstraints,
        currentMonth
      )

      // Get last cooked date if available
      const lastCookedAt = recipe.plannedRecipes.length > 0
        ? recipe.plannedRecipes[0].addedAt
        : null

      return {
        id: String(recipe.id),
        name: recipe.title,
        imageUrl: recipe.image || undefined,
        prepTime: recipe.preparationTime || undefined,
        cookTime: recipe.cookingTime || undefined,
        servings: undefined, // Not in schema yet
        lastCookedAt: lastCookedAt || undefined,
        matchPercentage
      }
    })

    // Sort by match percentage (desc), then by lastCookedAt (asc - less recently cooked first)
    recipesWithScores.sort((a, b) => {
      // First by match percentage (higher is better)
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage
      }

      // Then by last cooked (less recently cooked first, null means never cooked - prioritize those)
      if (!a.lastCookedAt && !b.lastCookedAt) return 0
      if (!a.lastCookedAt) return -1 // Never cooked comes first
      if (!b.lastCookedAt) return 1
      return a.lastCookedAt.getTime() - b.lastCookedAt.getTime()
    })

    // Define perfect match threshold (90% or higher)
    const perfectMatchThreshold = 90

    // Split into perfect and partial matches
    const perfectMatches = recipesWithScores.filter(r => r.matchPercentage >= perfectMatchThreshold)
    const partialMatches = recipesWithScores.filter(r => r.matchPercentage < perfectMatchThreshold)

    // Apply pagination
    const paginatedPerfect = perfectMatches.slice(offset, offset + limit)
    const remainingLimit = limit - paginatedPerfect.length

    let paginatedPartial: typeof partialMatches = []
    if (remainingLimit > 0) {
      // If we have room after perfect matches, add partial matches
      const partialOffset = Math.max(0, offset - perfectMatches.length)
      paginatedPartial = partialMatches.slice(partialOffset, partialOffset + remainingLimit)
    } else if (perfectMatches.length <= offset) {
      // If offset is beyond perfect matches, show partial matches
      const partialOffset = offset - perfectMatches.length
      paginatedPartial = partialMatches.slice(partialOffset, partialOffset + limit)
    }

    // Check if there are more results
    const totalShown = offset + paginatedPerfect.length + paginatedPartial.length
    const totalAvailable = perfectMatches.length + partialMatches.length
    const hasMore = totalShown < totalAvailable

    const response = {
      perfectMatches: paginatedPerfect,
      partialMatches: paginatedPartial,
      hasMore
    }

    // Validate response
    const validated = SuggestionSectionsSchema.safeParse(response)
    if (!validated.success) {
      console.error('Response validation failed:', validated.error)
      return NextResponse.json(
        { error: 'Failed to validate response', details: validated.error.errors },
        { status: 500 }
      )
    }

    return NextResponse.json(validated.data, { status: 200 })
  } catch (error) {
    console.error('Recipe suggestion API error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error during recipe suggestion' },
      { status: 500 }
    )
  }
}

export async function GET () {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

