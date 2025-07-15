import { prisma } from './prisma'

export interface TagSuggestion {
  tag: string
  frequency: number
  similarity?: number
}

export interface TagValidationResult {
  isValid: boolean
  error?: string
  normalizedTag?: string
}

/**
 * Normalizes a tag by converting to lowercase and cleaning up spacing
 * @param tag - The raw tag input
 * @returns The normalized tag
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\p{L}\p{N}\s\-&]/gu, '') // Allow letters (including accented), numbers, spaces, hyphens, and ampersands
}

/**
 * Validates a tag according to business rules
 * @param tag - The tag to validate
 * @param existingTags - Array of existing tags to check for duplicates
 * @returns Validation result with error message if invalid
 */
export function validateTag(tag: string, existingTags: string[] = []): TagValidationResult {
  const normalizedTag = normalizeTag(tag)
  
  // Check if tag is empty after normalization
  if (!normalizedTag || normalizedTag.length === 0) {
    return {
      isValid: false,
      error: 'Tag cannot be empty'
    }
  }
  
  // Check minimum length
  if (normalizedTag.length < 2) {
    return {
      isValid: false,
      error: 'Tag must be at least 2 characters long'
    }
  }
  
  // Check maximum length
  if (normalizedTag.length > 50) {
    return {
      isValid: false,
      error: 'Tag cannot exceed 50 characters'
    }
  }
  
  // Check for duplicates (case-insensitive)
  const normalizedExisting = existingTags.map(t => normalizeTag(t))
  if (normalizedExisting.includes(normalizedTag)) {
    return {
      isValid: false,
      error: 'Tag already exists'
    }
  }
  
  return {
    isValid: true,
    normalizedTag
  }
}

/**
 * Validates an array of tags and checks the maximum limit
 * @param tags - Array of tags to validate
 * @param maxTags - Maximum number of tags allowed (default 100)
 * @returns Validation result
 */
export function validateTagArray(tags: string[], maxTags: number = 100): TagValidationResult {
  if (tags.length > maxTags) {
    return {
      isValid: false,
      error: `Cannot exceed ${maxTags} tags per recipe`
    }
  }
  
  // Check for duplicates within the array
  const normalizedTags = tags.map(normalizeTag)
  const uniqueTags = new Set(normalizedTags)
  
  if (uniqueTags.size !== normalizedTags.length) {
    return {
      isValid: false,
      error: 'Duplicate tags are not allowed'
    }
  }
  
  return {
    isValid: true
  }
}

/**
 * Calculates similarity between two tags using simple string comparison
 * @param tag1 - First tag
 * @param tag2 - Second tag
 * @returns Similarity score between 0 and 1
 */
export function calculateTagSimilarity(tag1: string, tag2: string): number {
  const normalized1 = normalizeTag(tag1)
  const normalized2 = normalizeTag(tag2)
  
  // Exact match
  if (normalized1 === normalized2) {
    return 1.0
  }
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8
  }
  
  // Simple character overlap calculation
  const set1 = new Set(normalized1.split(''))
  const set2 = new Set(normalized2.split(''))
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return intersection.size / union.size
}

/**
 * Finds similar existing tags for a given input
 * @param input - The input tag to find similarities for
 * @param existingTags - Array of existing tags with their frequencies
 * @param threshold - Minimum similarity threshold (default 0.5)
 * @returns Array of similar tags sorted by similarity
 */
export function findSimilarTags(
  input: string,
  existingTags: TagSuggestion[],
  threshold: number = 0.5
): TagSuggestion[] {
  const normalizedInput = normalizeTag(input)
  
  if (!normalizedInput) {
    return []
  }
  
  return existingTags
    .map(tagSuggestion => ({
      ...tagSuggestion,
      similarity: calculateTagSimilarity(normalizedInput, tagSuggestion.tag)
    }))
    .filter(tagSuggestion => tagSuggestion.similarity >= threshold)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
}

/**
 * Filters tag suggestions based on user input
 * @param input - The user's input string
 * @param allTags - All available tags with frequencies
 * @param maxSuggestions - Maximum number of suggestions to return
 * @returns Filtered and sorted suggestions
 */
export function filterTagSuggestions(
  input: string,
  allTags: TagSuggestion[],
  maxSuggestions: number = 10
): TagSuggestion[] {
  const normalizedInput = normalizeTag(input)
  
  if (!normalizedInput) {
    // Return most frequent tags if no input
    return allTags
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxSuggestions)
  }
  
  // Find exact matches first
  const exactMatches = allTags.filter(tag => 
    normalizeTag(tag.tag).startsWith(normalizedInput)
  )
  
  // Find partial matches
  const partialMatches = allTags.filter(tag => 
    normalizeTag(tag.tag).includes(normalizedInput) && 
    !normalizeTag(tag.tag).startsWith(normalizedInput)
  )
  
  // Combine and sort by frequency within each group
  const sortedExact = exactMatches.sort((a, b) => b.frequency - a.frequency)
  const sortedPartial = partialMatches.sort((a, b) => b.frequency - a.frequency)
  
  return [...sortedExact, ...sortedPartial].slice(0, maxSuggestions)
}

/**
 * Increments the frequency count for a tag
 * @param tag - The tag to increment
 * @param currentFrequency - Current frequency count
 * @returns New frequency count
 */
export function incrementTagFrequency(tag: string, currentFrequency: number = 0): number {
  return currentFrequency + 1
}

/**
 * Prepares tags for database storage
 * @param tags - Array of raw tag strings
 * @returns Array of normalized, validated tags
 */
export function prepareTagsForStorage(tags: string[]): string[] {
  // Normalize and remove duplicates
  const normalizedTags = tags
    .map(normalizeTag)
    .filter(tag => tag.length > 0)
  
  // Remove duplicates while preserving order
  const uniqueTags = normalizedTags.filter((tag, index) => 
    normalizedTags.indexOf(tag) === index
  )
  
  return uniqueTags
}

/**
 * Extracts common tag patterns from recipe content for LLM suggestions
 * @param recipeContent - Recipe title, ingredients, instructions
 * @returns Array of potential tag categories to suggest
 */
export function extractTagCategories(recipeContent: {
  title?: string
  ingredients?: string[]
  instructions?: string
}): string[] {
  const categories: string[] = []
  const content = [
    recipeContent.title || '',
    ...(recipeContent.ingredients || []),
    recipeContent.instructions || ''
  ].join(' ').toLowerCase()
  
  // Cuisine patterns
  const cuisinePatterns = [
    'italian', 'chinese', 'mexican', 'indian', 'french', 'japanese',
    'thai', 'mediterranean', 'korean', 'vietnamese', 'greek', 'spanish'
  ]
  
  // Dietary patterns
  const dietaryPatterns = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo',
    'low-carb', 'sugar-free', 'nut-free', 'soy-free'
  ]
  
  // Meal type patterns
  const mealPatterns = [
    'breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'appetizer',
    'side dish', 'main course', 'soup', 'salad', 'drink', 'beverage'
  ]
  
  // Cooking method patterns
  const methodPatterns = [
    'baked', 'grilled', 'fried', 'steamed', 'roasted', 'sautéed',
    'slow-cooked', 'instant pot', 'no-cook', 'one-pot'
  ]
  
  // Check for patterns in content
  const allPatterns = [...cuisinePatterns, ...dietaryPatterns, ...mealPatterns, ...methodPatterns]
  
  allPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      categories.push(pattern)
    }
  })
  
  return categories
}

/**
 * Fetch canonical tags from the database
 * Returns a list of tags that have been used by users, sorted by frequency
 */
export async function getCanonicalTags(limit: number = 100): Promise<string[]> {
  try {
    // Use any type to bypass TypeScript issues temporarily
    const tagUsage = await (prisma as any).tagUsage.findMany({
      orderBy: [
        { frequency: 'desc' },
        { lastUsed: 'desc' }
      ],
      take: limit,
      select: {
        tag: true
      }
    })
    
    if (Array.isArray(tagUsage) && tagUsage.length > 0) {
      return tagUsage.map((t: { tag: string }) => t.tag)
    }
    
    // If no tags in database, return curated list
    return [
      'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'quick', 'easy',
      'dinner', 'lunch', 'breakfast', 'dessert', 'snack', 'appetizer',
      'italian', 'french', 'mediterranean', 'asian', 'mexican', 'indian',
      'baked', 'grilled', 'fried', 'slow-cooked', 'one-pot', 'healthy',
      'comfort-food', 'spicy', 'sweet', 'savory', 'fresh', 'seasonal',
      'chicken', 'beef', 'fish', 'pasta', 'rice', 'salad', 'soup', 'stew',
      'breakfast', 'brunch', 'lunch', 'dinner', 'dessert', 'snack'
    ]
  } catch (error) {
    console.error('Error fetching canonical tags from database:', error)
    // Return curated list as fallback
    return [
      'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'quick', 'easy',
      'dinner', 'lunch', 'breakfast', 'dessert', 'snack', 'appetizer',
      'italian', 'french', 'mediterranean', 'asian', 'mexican', 'indian',
      'baked', 'grilled', 'fried', 'slow-cooked', 'one-pot', 'healthy',
      'comfort-food', 'spicy', 'sweet', 'savory', 'fresh', 'seasonal',
      'chicken', 'beef', 'fish', 'pasta', 'rice', 'salad', 'soup', 'stew',
      'breakfast', 'brunch', 'lunch', 'dinner', 'dessert', 'snack'
    ]
  }
}

/**
 * Add a new tag to the canonical list or update its usage frequency
 */
export async function addTagToCanonicalList(tag: string, userId: string = 'default'): Promise<void> {
  try {
    await (prisma as any).tagUsage.upsert({
      where: {
        userId_tag: {
          userId,
          tag
        }
      },
      update: {
        frequency: {
          increment: 1
        },
        lastUsed: new Date()
      },
      create: {
        userId,
        tag,
        frequency: 1,
        lastUsed: new Date()
      }
    })
    console.log(`Tag "${tag}" added to canonical list for user "${userId}"`)
  } catch (error) {
    console.error('Error adding tag to canonical list:', error)
  }
}

/**
 * Get a dynamic tag suggestion prompt that includes the canonical tag list
 */
export async function getDynamicTagSuggestionPrompt(): Promise<string> {
  const canonicalTags = await getCanonicalTags(50) // Limit to top 50 most used tags
  
  return `You are an expert recipe tagging assistant. Given a recipe's title, ingredients, and instructions, analyze the content and return a concise list of relevant tags.

IMPORTANT RULES:
1. Only use tags from this canonical list: ${JSON.stringify(canonicalTags)}
2. Do NOT invent new tags or use synonyms not in the list above
3. Do NOT add "free-from" or allergy tags unless the recipe explicitly states it
4. Do NOT add generic ingredient tags unless they are a main component
5. Use only one tag for each concept (e.g., use "vegan", not "vegan-friendly" or "plant-based")
6. Do NOT use tags about ingredients that are not mentioned in the recipe

Return only a JSON array of strings from the canonical list above, no explanations or extra text.`
} 