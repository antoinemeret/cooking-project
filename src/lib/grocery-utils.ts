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
    // "3 c. à s. d'huile d'olive", "4 cuil. à soupe de coriandre"
    /^(\d+(?:\.\d+)?)\s+(c\.\s*à\s*s\.|cuil\.\s*à\s*soupe|c\.à\.s\.|cas)\s+(?:de?\s+|d')?(.+)$/i,
    // "1 c. à c. de sel", "2 cuil. à café de vanille"  
    /^(\d+(?:\.\d+)?)\s+(c\.\s*à\s*c\.|cuil\.\s*à\s*café|c\.à\.c\.|cac)\s+(?:de?\s+|d')?(.+)$/i,
    // "2 cups flour", "1.5 tbsp olive oil"
    /^(\d+(?:\.\d+)?)\s+([a-zA-Z.àé]+(?:\s+à\s+[a-zA-Z]+)?)\s+(?:de?\s+|d')?(.+)$/,
    // "2 large eggs", "1 medium onion"
    /^(\d+(?:\.\d+)?)\s+(large|medium|small|whole|gros|grosse|moyen|moyenne|petit|petite)\s+(.+)$/,
    // "500g flour", "2kg chicken", "500 grammes de"
    /^(\d+(?:\.\d+)?)([a-zA-Z]+)\s+(?:de?\s+|d')?(.+)$/,
    // "1/2 cup sugar", "3/4 tsp salt", "1/2 c. à s. d'huile"
    /^(\d+\/\d+)\s+(c\.\s*à\s*s\.|cuil\.\s*à\s*soupe|c\.à\.s\.|cas|c\.\s*à\s*c\.|cuil\.\s*à\s*café|c\.à\.c\.|cac|[a-zA-Z.àé]+(?:\s+à\s+[a-zA-Z]+)?)\s+(?:de?\s+|d')?(.+)$/i,
    // "2 Tomates", "3 oeufs" (standalone numbers without units)
    /^(\d+(?:\.\d+)?)\s+(.+)$/,
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
      
      // Clean the ingredient name by removing preparation instructions
      const cleanedName = removePreparationInstructions((name || unit).trim())
      
      // For standalone numbers (last pattern), unit is actually the name
      const finalUnit = name ? unit.toLowerCase() : undefined
      
      return {
        name: cleanedName,
        quantity,
        unit: finalUnit,
        originalText: text
      }
    }
  }
  
  // If no pattern matches, clean the entire text and treat as ingredient name
  const cleanedText = removePreparationInstructions(text)
  return {
    name: cleanedText,
    originalText: text
  }
}

/**
 * Remove preparation instructions from ingredient names
 */
function removePreparationInstructions(ingredientName: string): string {
  let cleaned = ingredientName
  
  // Common preparation instruction patterns to remove
  const preparationPatterns = [
    // French preparation instructions
    /\s*ciselée?\s+en\s+morceaux\s+irréguliers/gi,
    /\s*ciselée?\s+en\s+morceaux/gi,
    /\s*ciselée?\s*/gi,
    /\s*hachée?\s*/gi,
    /\s*émincée?\s*/gi,
    /\s*coupée?\s+en\s+dés/gi,
    /\s*coupée?\s+en\s+lamelles/gi,
    /\s*coupée?\s+en\s+tranches/gi,
    /\s*coupée?\s+en\s+deux/gi,
    /\s*épépinée?\s*/gi,
    /\s*pelée?\s*/gi,
    /\s*écrasée?\s*/gi,
    /\s*râpée?\s*/gi,
    /\s*finement\s+hachée?/gi,
    /\s*grossièrement\s+hachée?/gi,
    
    // English preparation instructions
    /\s*chopped\s+into\s+irregular\s+pieces/gi,
    /\s*chopped\s+finely/gi,
    /\s*finely\s+chopped/gi,
    /\s*roughly\s+chopped/gi,
    /\s*coarsely\s+chopped/gi,
    /\s*chopped/gi,
    /\s*diced/gi,
    /\s*sliced/gi,
    /\s*minced/gi,
    /\s*grated/gi,
    /\s*peeled/gi,
    /\s*seeded/gi,
    /\s*crushed/gi,
    /\s*julienned/gi,
    
    // Cooking state instructions
    /\s*\(.*\)/gi, // Remove anything in parentheses
    /\s*,\s*.*$/gi, // Remove everything after first comma (often preparation notes)
  ]
  
  // Apply all patterns
  for (const pattern of preparationPatterns) {
    cleaned = cleaned.replace(pattern, '')
  }
  
  // Clean up extra spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // If we removed too much and left nothing meaningful, return original
  if (cleaned.length < 3) {
    return ingredientName
  }
  
  return cleaned
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
  
  // Extract base ingredient names by removing descriptive words
  const baseIngredient1 = extractBaseIngredient(normalized1)
  const baseIngredient2 = extractBaseIngredient(normalized2)
  
  // Compare base ingredients
  if (baseIngredient1 === baseIngredient2) return true
  
  // Common ingredient variations (multilingual support)
  const variations: Record<string, string[]> = {
    // Tomatoes (English/French)
    'tomato': ['tomatoes', 'fresh tomatoes', 'tomate', 'tomates'],
    'tomate': ['tomatoes', 'fresh tomatoes', 'tomato', 'tomates'],
    
    // Onions (English/French)
    'onion': ['onions', 'yellow onion', 'white onion', 'oignon', 'oignons'],
    'oignon': ['onions', 'yellow onion', 'white onion', 'onion', 'oignons'],
    
    // Garlic (English/French)
    'garlic': ['garlic cloves', 'garlic clove', 'fresh garlic', 'ail', 'gousse dail'],
    'ail': ['garlic cloves', 'garlic clove', 'fresh garlic', 'garlic', 'gousse dail'],
    
    // Common seasonings
    'salt': ['sea salt', 'kosher salt', 'table salt', 'sel'],
    'sel': ['sea salt', 'kosher salt', 'table salt', 'salt'],
    'pepper': ['black pepper', 'ground pepper', 'freshly ground pepper', 'poivre'],
    'poivre': ['black pepper', 'ground pepper', 'freshly ground pepper', 'pepper'],
    
    // Oils and fats
    'oil': ['olive oil', 'vegetable oil', 'cooking oil', 'huile'],
    'huile': ['olive oil', 'vegetable oil', 'cooking oil', 'oil'],
    'butter': ['unsalted butter', 'salted butter', 'beurre'],
    'beurre': ['unsalted butter', 'salted butter', 'butter'],
    
    // Flour and grains
    'flour': ['all-purpose flour', 'plain flour', 'farine'],
    'farine': ['all-purpose flour', 'plain flour', 'flour'],
    'sugar': ['white sugar', 'granulated sugar', 'caster sugar', 'sucre'],
    'sucre': ['white sugar', 'granulated sugar', 'caster sugar', 'sugar'],
    
    // Eggs
    'egg': ['eggs', 'oeuf', 'oeufs'],
    'oeuf': ['eggs', 'egg', 'oeufs'],
    'oeufs': ['eggs', 'egg', 'oeuf']
  }
  
  // Check variations for both base ingredients
  for (const [base, variants] of Object.entries(variations)) {
    const allVariants = [base, ...variants]
    if (allVariants.includes(baseIngredient1) && allVariants.includes(baseIngredient2)) {
      return true
    }
  }
  
  return false
}

/**
 * Format quantity and unit for display (used when combining different units)
 */
function formatQuantityAndUnit(quantity?: number, unit?: string, name?: string): string {
  if (quantity && unit) {
    return `${quantity} ${unit}`
  } else if (quantity) {
    return `${quantity}`
  }
  return name || ''
}

/**
 * Get the best representative name for merged ingredients
 */
function getBaseIngredientName(name1: string, name2: string): string {
  // Extract clean ingredient names without quantities
  const clean1 = cleanIngredientName(name1)
  const clean2 = cleanIngredientName(name2)
  
  const base1 = extractBaseIngredient(normalizeIngredientName(clean1))
  const base2 = extractBaseIngredient(normalizeIngredientName(clean2))
  
  // If they have the same base, choose the more descriptive original name
  if (base1 === base2) {
    return clean1.length >= clean2.length ? clean1 : clean2
  }
  
  // Otherwise, use the first one
  return clean1
}

/**
 * Clean ingredient name by removing any embedded quantities/units
 */
function cleanIngredientName(name: string): string {
  // Remove patterns like "500 grammes" or "2" from the beginning of ingredient names
  return name
    .replace(/^\d+(?:\.\d+)?\s*[a-zA-Z]*\s+/g, '') // Remove "500 grammes " or "2 "
    .replace(/^\d+(?:\.\d+)?\s+/g, '') // Remove standalone numbers
    .trim()
}

/**
 * Extract the base ingredient name by removing descriptive modifiers
 */
function extractBaseIngredient(normalizedName: string): string {
  // Remove common descriptive words (size, color, preparation, etc.)
  const descriptiveWords = [
    // Size descriptors
    'large', 'medium', 'small', 'big', 'tiny', 'huge',
    'gros', 'grosse', 'moyen', 'moyenne', 'petit', 'petite',
    
    // Color descriptors  
    'red', 'green', 'yellow', 'white', 'black', 'brown',
    'rouge', 'vert', 'verte', 'jaune', 'blanc', 'blanche', 'noir', 'noire',
    
    // Preparation descriptors
    'fresh', 'dried', 'frozen', 'canned', 'chopped', 'sliced', 'diced',
    'frais', 'fraiche', 'sec', 'seche', 'surgele', 'en conserve', 'hache',
    
    // Quality descriptors
    'organic', 'free range', 'extra virgin', 'whole', 'ground',
    'bio', 'entier', 'entiere', 'moulu', 'moulue'
  ]
  
  let baseIngredient = normalizedName
  
  // Remove descriptive words
  for (const word of descriptiveWords) {
    // Remove word at the beginning or end, or surrounded by spaces
    baseIngredient = baseIngredient
      .replace(new RegExp(`^${word}\\s+`, 'i'), '')
      .replace(new RegExp(`\\s+${word}$`, 'i'), '')
      .replace(new RegExp(`\\s+${word}\\s+`, 'i'), ' ')
  }
  
  // Remove extra spaces and trim
  baseIngredient = baseIngredient.replace(/\s+/g, ' ').trim()
  
  return baseIngredient
}

/**
 * Normalize units for quantity aggregation
 */
export function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    // Volume - English
    'cup': 'cup', 'cups': 'cup',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    
    // Volume - French
    'cuil. à soupe': 'tbsp', 'cuillère à soupe': 'tbsp', 'cuillères à soupe': 'tbsp',
    'c. à s.': 'tbsp', 'c.à.s.': 'tbsp', 'cas': 'tbsp',
    'cuil. à café': 'tsp', 'cuillère à café': 'tsp', 'cuillères à café': 'tsp', 
    'c. à c.': 'tsp', 'c.à.c.': 'tsp', 'cac': 'tsp',
    'cl': 'cl', 'centilitre': 'cl', 'centilitres': 'cl',
    'dl': 'dl', 'décilitre': 'dl', 'décilitres': 'dl',
    
    // Weight - English
    'g': 'g', 'gram': 'g', 'grams': 'g', 
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
    
    // Weight - French
    'gramme': 'g', 'grammes': 'g',
    'kilogramme': 'kg', 'kilogrammes': 'kg',
    
    // Count
    'piece': 'piece', 'pieces': 'piece',
    'whole': 'whole', 'entier': 'whole', 'entière': 'whole',
    'large': 'large', 'medium': 'medium', 'small': 'small',
    'gros': 'large', 'grosse': 'large', 
    'moyen': 'medium', 'moyenne': 'medium',
    'petit': 'small', 'petite': 'small'
  }
  
  // Clean the unit string and normalize
  const cleanedUnit = unit.toLowerCase().trim()
  return unitMap[cleanedUnit] || cleanedUnit
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
        
        // Handle quantity and unit aggregation
        if (parsed.quantity && parsed.unit && existing.quantity && existing.unit) {
          const normalizedExistingUnit = normalizeUnit(existing.unit)
          const normalizedParsedUnit = normalizeUnit(parsed.unit)
          
          if (normalizedExistingUnit === normalizedParsedUnit) {
            // Same units - add quantities
            existing.quantity += parsed.quantity
            existing.name = getBaseIngredientName(existing.name, parsed.name)
          } else {
            // Different units - combine with "+" notation
            const baseIngredientName = getBaseIngredientName(existing.name, parsed.name)
            const existingDisplay = formatQuantityAndUnit(existing.quantity, existing.unit)
            const parsedDisplay = formatQuantityAndUnit(parsed.quantity, parsed.unit)
            existing.name = `${existingDisplay} + ${parsedDisplay} ${baseIngredientName}`
            existing.quantity = undefined
            existing.unit = undefined
          }
        } else if (parsed.quantity && !parsed.unit && existing.quantity && !existing.unit) {
          // Both have quantities but no units (e.g., "2 tomates" + "4 tomates")
          existing.quantity += parsed.quantity
          existing.name = getBaseIngredientName(existing.name, parsed.name)
        } else if (parsed.quantity && existing.quantity) {
          // One has unit, one doesn't - combine with "+"
          const baseIngredientName = getBaseIngredientName(existing.name, parsed.name)
          const existingDisplay = formatQuantityAndUnit(existing.quantity, existing.unit)
          const parsedDisplay = formatQuantityAndUnit(parsed.quantity, parsed.unit)
          existing.name = `${existingDisplay} + ${parsedDisplay} ${baseIngredientName}`
          existing.quantity = undefined
          existing.unit = undefined
        } else if (parsed.quantity && !existing.quantity) {
          // New item has quantity, existing doesn't - use the more specific one
          existing.quantity = parsed.quantity
          existing.unit = parsed.unit
          existing.name = getBaseIngredientName(existing.name, parsed.name)
        } else if (!parsed.quantity && existing.quantity) {
          // Existing has quantity, new doesn't - keep existing
          existing.name = getBaseIngredientName(existing.name, parsed.name)
        } else {
          // Neither has quantities, just merge names
          existing.name = getBaseIngredientName(existing.name, parsed.name)
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
  
  // Only prepend quantity and unit if we have both and the name doesn't already include them
  if (ingredient.quantity && ingredient.unit && !ingredient.name.includes('+')) {
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