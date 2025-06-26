import { Recipe, Ingredient } from '@prisma/client'

// Type for Recipe with ingredients relation loaded
type RecipeWithIngredients = Recipe & {
  ingredients: Ingredient[]
}

/**
 * Get the current month as a number (1-12)
 */
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1 // getMonth() returns 0-11, we need 1-12
}

/**
 * Check if a recipe is in season based on current date
 * Handles cases where season spans across year boundary (e.g., Nov-Feb)
 */
export function isRecipeInSeason(recipe: Pick<Recipe, 'startSeason' | 'endSeason'>, currentMonth?: number): boolean {
  const month = currentMonth ?? getCurrentMonth()
  const { startSeason, endSeason } = recipe
  
  // If start and end are the same, recipe is available year-round in that month
  if (startSeason === endSeason) {
    return month === startSeason
  }
  
  // If start <= end, normal season (e.g., March to August)
  if (startSeason <= endSeason) {
    return month >= startSeason && month <= endSeason
  }
  
  // If start > end, season spans year boundary (e.g., November to February)
  return month >= startSeason || month <= endSeason
}

/**
 * Filter recipes that are currently in season
 */
export function filterRecipesBySeason<T extends Pick<Recipe, 'startSeason' | 'endSeason'>>(
  recipes: T[], 
  currentMonth?: number
): T[] {
  return recipes.filter(recipe => isRecipeInSeason(recipe, currentMonth))
}

/**
 * Filter recipes by tags (case-insensitive partial matching)
 */
export function filterRecipesByTags<T extends Pick<Recipe, 'title' | 'summary'>>(
  recipes: T[], 
  requiredTags: string[]
): T[] {
  if (requiredTags.length === 0) return recipes
  
  return recipes.filter(recipe => {
    // For now, we'll check against title and summary since tags field doesn't exist yet
    // This will be updated when we add the tags field to the Recipe model
    const searchText = `${recipe.title} ${recipe.summary}`.toLowerCase()
    
    return requiredTags.some(tag => 
      searchText.includes(tag.toLowerCase())
    )
  })
}

/**
 * Filter recipes by ingredients (using cleaned Ingredient entities)
 * This is the preferred method as it uses the normalized Ingredient data
 * Note: Requires recipes to be loaded with ingredients relation
 */
export function filterRecipesByIngredients(
  recipes: RecipeWithIngredients[], 
  requiredIngredients: string[] = [], 
  excludedIngredients: string[] = []
): RecipeWithIngredients[] {
  return recipes.filter(recipe => {
    const ingredientNames = recipe.ingredients.map(ing => ing.name.toLowerCase())
    
    // Check required ingredients
    if (requiredIngredients.length > 0) {
      const hasRequired = requiredIngredients.some(requiredIngredient =>
        ingredientNames.some(ingredientName =>
          ingredientName.includes(requiredIngredient.toLowerCase())
        )
      )
      if (!hasRequired) return false
    }
    
    // Check excluded ingredients
    if (excludedIngredients.length > 0) {
      const hasExcluded = excludedIngredients.some(excludedIngredient =>
        ingredientNames.some(ingredientName =>
          ingredientName.includes(excludedIngredient.toLowerCase())
        )
      )
      if (hasExcluded) return false
    }
    
    return true
  })
}

/**
 * Alternative ingredient filter for recipes without ingredients relation loaded
 * Falls back to rawIngredients JSON parsing
 */
export function filterRecipesByRawIngredients(
  recipes: Recipe[], 
  requiredIngredients: string[] = [], 
  excludedIngredients: string[] = []
): Recipe[] {
  return recipes.filter(recipe => {
    let rawIngredients: any[] = []
    
    try {
      rawIngredients = JSON.parse(recipe.rawIngredients)
    } catch {
      // If JSON parsing fails, fall back to string search
      const ingredientsText = recipe.rawIngredients.toLowerCase()
      
      // Check required ingredients
      if (requiredIngredients.length > 0) {
        const hasRequired = requiredIngredients.some(ingredient =>
          ingredientsText.includes(ingredient.toLowerCase())
        )
        if (!hasRequired) return false
      }
      
      // Check excluded ingredients
      if (excludedIngredients.length > 0) {
        const hasExcluded = excludedIngredients.some(ingredient =>
          ingredientsText.includes(ingredient.toLowerCase())
        )
        if (hasExcluded) return false
      }
      
      return true
    }
    
    // If JSON parsing succeeded, search in ingredient names
    const ingredientNames = rawIngredients
      .map(ing => (ing.name || '').toLowerCase())
      .join(' ')
    
    // Check required ingredients
    if (requiredIngredients.length > 0) {
      const hasRequired = requiredIngredients.some(ingredient =>
        ingredientNames.includes(ingredient.toLowerCase())
      )
      if (!hasRequired) return false
    }
    
    // Check excluded ingredients
    if (excludedIngredients.length > 0) {
      const hasExcluded = excludedIngredients.some(ingredient =>
        ingredientNames.includes(ingredient.toLowerCase())
      )
      if (hasExcluded) return false
    }
    
    return true
  })
}

/**
 * Combined recipe filtering function for recipes with ingredients relation
 */
export function filterRecipes(
  recipes: RecipeWithIngredients[],
  filters: {
    seasonality?: boolean
    tags?: string[]
    requiredIngredients?: string[]
    excludedIngredients?: string[]
    currentMonth?: number
  } = {}
): RecipeWithIngredients[] {
  let filteredRecipes = recipes
  
  // Apply seasonality filter
  if (filters.seasonality) {
    filteredRecipes = filterRecipesBySeason(filteredRecipes, filters.currentMonth)
  }
  
  // Apply tags filter
  if (filters.tags && filters.tags.length > 0) {
    filteredRecipes = filterRecipesByTags(filteredRecipes, filters.tags)
  }
  
  // Apply ingredients filter
  if (filters.requiredIngredients?.length || filters.excludedIngredients?.length) {
    filteredRecipes = filterRecipesByIngredients(
      filteredRecipes,
      filters.requiredIngredients,
      filters.excludedIngredients
    )
  }
  
  return filteredRecipes
}

/**
 * Combined recipe filtering function for recipes without ingredients relation
 * Falls back to rawIngredients parsing for ingredient filtering
 */
export function filterRecipesWithoutRelations(
  recipes: Recipe[],
  filters: {
    seasonality?: boolean
    tags?: string[]
    requiredIngredients?: string[]
    excludedIngredients?: string[]
    currentMonth?: number
  } = {}
): Recipe[] {
  let filteredRecipes = recipes
  
  // Apply seasonality filter
  if (filters.seasonality) {
    filteredRecipes = filterRecipesBySeason(filteredRecipes, filters.currentMonth)
  }
  
  // Apply tags filter
  if (filters.tags && filters.tags.length > 0) {
    filteredRecipes = filterRecipesByTags(filteredRecipes, filters.tags)
  }
  
  // Apply ingredients filter using rawIngredients
  if (filters.requiredIngredients?.length || filters.excludedIngredients?.length) {
    filteredRecipes = filterRecipesByRawIngredients(
      filteredRecipes,
      filters.requiredIngredients,
      filters.excludedIngredients
    )
  }
  
  return filteredRecipes
}

/**
 * Get month name from month number (for display purposes)
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1] || 'Unknown'
}

/**
 * Get season description for a recipe
 */
export function getSeasonDescription(recipe: Pick<Recipe, 'startSeason' | 'endSeason'>): string {
  const { startSeason, endSeason } = recipe
  
  if (startSeason === endSeason) {
    return getMonthName(startSeason)
  }
  
  if (startSeason <= endSeason) {
    return `${getMonthName(startSeason)} - ${getMonthName(endSeason)}`
  }
  
  // Spans year boundary
  return `${getMonthName(startSeason)} - ${getMonthName(endSeason)} (across winter)`
} 