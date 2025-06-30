interface ParsedIngredient {
  name: string
  quantity?: number
  unit?: string
  originalText: string
}

interface AggregatedIngredient {
  name: string
  quantity?: number
  unit?: string
  sources: string[] // Recipe titles that contain this ingredient
  checked: boolean
}

/**
 * Parse ingredient text into structured components
 * Handles common patterns like "2 cups flour", "1 lb chicken", etc.
 */
export function parseIngredient(ingredientText: string): ParsedIngredient {
  const text = ingredientText.trim()
  
  // Common patterns for quantities and units
  const patterns = [
    // "2 cups flour", "1.5 tbsp olive oil"
    /^(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(.+)$/,
    // "2 large eggs", "1 medium onion"
    /^(\d+(?:\.\d+)?)\s+(large|medium|small|whole)\s+(.+)$/,
    // "500g flour", "2kg chicken"
    /^(\d+(?:\.\d+)?)([a-zA-Z]+)\s+(.+)$/,
    // "1/2 cup sugar", "3/4 tsp salt"
    /^(\d+\/\d+)\s+([a-zA-Z]+)\s+(.+)$/,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const [, quantityStr, unit, name] = match
      let quantity: number | undefined
      
      // Handle fractions
      if (quantityStr.includes('/')) {
        const [num, den] = quantityStr.split('/').map(Number)
        quantity = num / den
      } else {
        quantity = parseFloat(quantityStr)
      }
      
      return {
        name: name.trim(),
        quantity,
        unit: unit.toLowerCase(),
        originalText: text
      }
    }
  }
  
  // If no pattern matches, treat entire text as ingredient name
  return {
    name: text,
    originalText: text
  }
}

/**
 * Normalize ingredient names for better duplicate detection
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,()]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Check if two ingredients are likely the same item
 */
export function areIngredientsSimilar(name1: string, name2: string): boolean {
  const normalized1 = normalizeIngredientName(name1)
  const normalized2 = normalizeIngredientName(name2)
  
  // Exact match
  if (normalized1 === normalized2) return true
  
  // Check if one is contained in the other (e.g., "olive oil" vs "extra virgin olive oil")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true
  }
  
  // Common ingredient variations
  const variations: Record<string, string[]> = {
    'onion': ['onions', 'yellow onion', 'white onion'],
    'tomato': ['tomatoes', 'fresh tomatoes'],
    'garlic': ['garlic cloves', 'garlic clove', 'fresh garlic'],
    'salt': ['sea salt', 'kosher salt', 'table salt'],
    'pepper': ['black pepper', 'ground pepper', 'freshly ground pepper'],
    'oil': ['olive oil', 'vegetable oil', 'cooking oil'],
    'butter': ['unsalted butter', 'salted butter'],
    'flour': ['all-purpose flour', 'plain flour'],
    'sugar': ['white sugar', 'granulated sugar', 'caster sugar']
  }
  
  for (const [base, variants] of Object.entries(variations)) {
    if ((normalized1.includes(base) || variants.some(v => normalized1.includes(v))) &&
        (normalized2.includes(base) || variants.some(v => normalized2.includes(v)))) {
      return true
    }
  }
  
  return false
}

/**
 * Normalize units for quantity aggregation
 */
export function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    // Volume
    'cup': 'cup', 'cups': 'cup',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    
    // Weight
    'g': 'g', 'gram': 'g', 'grams': 'g', 'gramme': 'g', 'grammes': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
    
    // Count
    'piece': 'piece', 'pieces': 'piece',
    'whole': 'whole',
    'large': 'large', 'medium': 'medium', 'small': 'small'
  }
  
  return unitMap[unit.toLowerCase()] || unit.toLowerCase()
}

/**
 * Aggregate ingredients from multiple recipes
 */
export function aggregateIngredients(recipes: Array<{
  title: string
  rawIngredients: string
}>): AggregatedIngredient[] {
  const aggregated: AggregatedIngredient[] = []
  
  for (const recipe of recipes) {
    let ingredients: string[]
    
    try {
      ingredients = JSON.parse(recipe.rawIngredients)
    } catch {
      // If parsing fails, split by common delimiters
      ingredients = recipe.rawIngredients.split(/[,\n]/).filter(Boolean)
    }
    
    for (const ingredientText of ingredients) {
      const parsed = parseIngredient(ingredientText)
      
      // Find existing similar ingredient
      const existingIndex = aggregated.findIndex(existing => 
        areIngredientsSimilar(existing.name, parsed.name)
      )
      
      if (existingIndex >= 0) {
        const existing = aggregated[existingIndex]
        
        // Add recipe source
        if (!existing.sources.includes(recipe.title)) {
          existing.sources.push(recipe.title)
        }
        
        // Try to aggregate quantities if units are compatible
        if (parsed.quantity && parsed.unit && existing.quantity && existing.unit) {
          const normalizedExistingUnit = normalizeUnit(existing.unit)
          const normalizedParsedUnit = normalizeUnit(parsed.unit)
          
          if (normalizedExistingUnit === normalizedParsedUnit) {
            existing.quantity += parsed.quantity
          } else {
            // Units don't match, keep as separate items with more descriptive names
            existing.name = `${existing.name} (${existing.quantity} ${existing.unit} + ${parsed.quantity} ${parsed.unit})`
            existing.quantity = undefined
            existing.unit = undefined
          }
        }
      } else {
        // Add new ingredient
        aggregated.push({
          name: parsed.name,
          quantity: parsed.quantity,
          unit: parsed.unit,
          sources: [recipe.title],
          checked: false
        })
      }
    }
  }
  
  // Sort by name for better organization
  return aggregated.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Format ingredient for display in grocery list
 */
export function formatIngredientForDisplay(ingredient: AggregatedIngredient): string {
  let display = ingredient.name
  
  if (ingredient.quantity && ingredient.unit) {
    display = `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
  }
  
  // Add source info if from multiple recipes
  if (ingredient.sources.length > 1) {
    display += ` (${ingredient.sources.length} recipes)`
  }
  
  return display
}

/**
 * Calculate grocery list statistics
 */
export function calculateGroceryStats(ingredients: AggregatedIngredient[]) {
  const total = ingredients.length
  const checked = ingredients.filter(i => i.checked).length
  const remaining = total - checked
  const percentComplete = total > 0 ? Math.round((checked / total) * 100) : 0
  
  return {
    total,
    checked,
    remaining,
    percentComplete
  }
} 