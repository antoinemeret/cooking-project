import {
  normalizeTag,
  validateTag,
  validateTagArray,
  calculateTagSimilarity,
  findSimilarTags,
  filterTagSuggestions,
  incrementTagFrequency,
  prepareTagsForStorage,
  extractTagCategories,
  TagSuggestion,
  TagValidationResult
} from './tag-utils'

describe('Tag Utilities', () => {
  describe('normalizeTag', () => {
    it('should convert tag to lowercase', () => {
      expect(normalizeTag('ITALIAN')).toBe('italian')
      expect(normalizeTag('Vegetarian')).toBe('vegetarian')
    })

    it('should trim whitespace', () => {
      expect(normalizeTag('  italian  ')).toBe('italian')
      expect(normalizeTag('\tvegetarian\n')).toBe('vegetarian')
    })

    it('should replace multiple spaces with single space', () => {
      expect(normalizeTag('gluten   free')).toBe('gluten free')
      expect(normalizeTag('quick    and    easy')).toBe('quick and easy')
    })

    it('should remove invalid characters but keep allowed ones', () => {
      expect(normalizeTag('gluten-free')).toBe('gluten-free')
      expect(normalizeTag('nuts & seeds')).toBe('nuts & seeds')
      expect(normalizeTag('italian@#$%')).toBe('italian')
      expect(normalizeTag('test!@#$%^&*()+=[]{}|;:,.<>?')).toBe('test&')
    })

    it('should handle empty strings', () => {
      expect(normalizeTag('')).toBe('')
      expect(normalizeTag('   ')).toBe('')
    })
  })

  describe('validateTag', () => {
    it('should validate normal tags', () => {
      const result = validateTag('italian')
      expect(result.isValid).toBe(true)
      expect(result.normalizedTag).toBe('italian')
      expect(result.error).toBeUndefined()
    })

    it('should reject empty tags', () => {
      const result = validateTag('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Tag cannot be empty')
    })

    it('should reject tags that are empty after normalization', () => {
      const result = validateTag('   ')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Tag cannot be empty')
    })

    it('should reject tags that are too short', () => {
      const result = validateTag('a')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Tag must be at least 2 characters long')
    })

    it('should reject tags that are too long', () => {
      const longTag = 'a'.repeat(51)
      const result = validateTag(longTag)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Tag cannot exceed 50 characters')
    })

    it('should reject duplicate tags (case-insensitive)', () => {
      const existingTags = ['italian', 'vegetarian', 'gluten-free']
      const result = validateTag('ITALIAN', existingTags)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Tag already exists')
    })

    it('should allow valid tags at boundary lengths', () => {
      const twoCharTag = validateTag('ab')
      expect(twoCharTag.isValid).toBe(true)
      
      const fiftyCharTag = validateTag('a'.repeat(50))
      expect(fiftyCharTag.isValid).toBe(true)
    })
  })

  describe('validateTagArray', () => {
    it('should validate normal tag arrays', () => {
      const tags = ['italian', 'vegetarian', 'quick']
      const result = validateTagArray(tags)
      expect(result.isValid).toBe(true)
    })

    it('should reject arrays exceeding max limit', () => {
      const tags = Array(101).fill('tag')
      const result = validateTagArray(tags, 100)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Cannot exceed 100 tags per recipe')
    })

    it('should reject arrays with duplicates', () => {
      const tags = ['italian', 'ITALIAN', 'vegetarian']
      const result = validateTagArray(tags)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Duplicate tags are not allowed')
    })

    it('should allow arrays at max limit', () => {
      const tags = Array(100).fill(0).map((_, i) => `tag${i}`)
      const result = validateTagArray(tags, 100)
      expect(result.isValid).toBe(true)
    })
  })

  describe('calculateTagSimilarity', () => {
    it('should return 1.0 for identical tags', () => {
      expect(calculateTagSimilarity('italian', 'italian')).toBe(1.0)
      expect(calculateTagSimilarity('ITALIAN', 'italian')).toBe(1.0)
    })

    it('should return 0.8 for substring matches', () => {
      expect(calculateTagSimilarity('gluten', 'gluten-free')).toBe(0.8)
      expect(calculateTagSimilarity('gluten-free', 'gluten')).toBe(0.8)
    })

    it('should return similarity score for character overlap', () => {
      const similarity = calculateTagSimilarity('italian', 'asian')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(1)
    })

    it('should return 0 for completely different tags', () => {
      const similarity = calculateTagSimilarity('abc', 'xyz')
      expect(similarity).toBe(0)
    })
  })

  describe('findSimilarTags', () => {
    const existingTags: TagSuggestion[] = [
      { tag: 'italian', frequency: 10 },
      { tag: 'gluten-free', frequency: 8 },
      { tag: 'vegetarian', frequency: 15 },
      { tag: 'asian', frequency: 5 }
    ]

    it('should find similar tags above threshold', () => {
      const similar = findSimilarTags('gluten', existingTags, 0.5)
      expect(similar.length).toBeGreaterThan(0)
      expect(similar[0].tag).toBe('gluten-free')
    })

    it('should sort by similarity score', () => {
      const similar = findSimilarTags('italian', existingTags, 0.1)
      expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1]?.similarity || 0)
    })

    it('should return empty array for no input', () => {
      const similar = findSimilarTags('', existingTags)
      expect(similar).toEqual([])
    })

    it('should filter by threshold', () => {
      const similar = findSimilarTags('xyz', existingTags, 0.9)
      expect(similar.length).toBe(0)
    })
  })

  describe('filterTagSuggestions', () => {
    const allTags: TagSuggestion[] = [
      { tag: 'italian', frequency: 10 },
      { tag: 'indian', frequency: 8 },
      { tag: 'vegetarian', frequency: 15 },
      { tag: 'vegan', frequency: 12 },
      { tag: 'gluten-free', frequency: 6 }
    ]

    it('should return most frequent tags when no input', () => {
      const suggestions = filterTagSuggestions('', allTags, 3)
      expect(suggestions.length).toBe(3)
      expect(suggestions[0].tag).toBe('vegetarian') // highest frequency
    })

    it('should prioritize exact matches over partial matches', () => {
      const suggestions = filterTagSuggestions('i', allTags, 5)
      const exactMatches = suggestions.filter(s => s.tag.startsWith('i'))
      expect(exactMatches.length).toBeGreaterThan(0)
    })

    it('should respect max suggestions limit', () => {
      const suggestions = filterTagSuggestions('', allTags, 2)
      expect(suggestions.length).toBe(2)
    })

    it('should handle partial matches', () => {
      const suggestions = filterTagSuggestions('veg', allTags, 5)
      expect(suggestions.some(s => s.tag === 'vegetarian')).toBe(true)
      expect(suggestions.some(s => s.tag === 'vegan')).toBe(true)
    })
  })

  describe('incrementTagFrequency', () => {
    it('should increment frequency by 1', () => {
      expect(incrementTagFrequency('italian', 5)).toBe(6)
      expect(incrementTagFrequency('new-tag', 0)).toBe(1)
    })

    it('should handle undefined current frequency', () => {
      expect(incrementTagFrequency('italian')).toBe(1)
    })
  })

  describe('prepareTagsForStorage', () => {
    it('should normalize and deduplicate tags', () => {
      const tags = ['  ITALIAN  ', 'vegetarian', 'ITALIAN', 'gluten-free', '']
      const prepared = prepareTagsForStorage(tags)
      expect(prepared).toEqual(['italian', 'vegetarian', 'gluten-free'])
    })

    it('should preserve order of first occurrence', () => {
      const tags = ['vegetarian', 'italian', 'VEGETARIAN', 'vegan']
      const prepared = prepareTagsForStorage(tags)
      expect(prepared).toEqual(['vegetarian', 'italian', 'vegan'])
    })

    it('should filter out empty tags', () => {
      const tags = ['italian', '', '   ', 'vegetarian']
      const prepared = prepareTagsForStorage(tags)
      expect(prepared).toEqual(['italian', 'vegetarian'])
    })
  })

  describe('extractTagCategories', () => {
    it('should extract cuisine tags from recipe content', () => {
      const recipe = {
        title: 'Delicious Italian Pasta',
        ingredients: ['pasta', 'tomato sauce', 'basil'],
        instructions: 'Cook the pasta in boiling water'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('italian')
    })

    it('should extract dietary tags from ingredients', () => {
      const recipe = {
        title: 'Healthy Salad',
        ingredients: ['lettuce', 'tomatoes', 'vegan cheese'],
        instructions: 'Mix all ingredients'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('vegan')
    })

    it('should extract meal type tags', () => {
      const recipe = {
        title: 'Breakfast Bowl',
        ingredients: ['oats', 'berries'],
        instructions: 'Combine and serve'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('breakfast')
    })

    it('should extract cooking method tags', () => {
      const recipe = {
        title: 'Baked Chicken',
        ingredients: ['chicken', 'herbs'],
        instructions: 'Bake in oven for 30 minutes'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('baked')
    })

    it('should handle missing or undefined fields', () => {
      const recipe = {
        title: 'Simple Recipe'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toEqual([])
    })

    it('should extract multiple categories', () => {
      const recipe = {
        title: 'Italian Vegan Soup',
        ingredients: ['vegetables', 'herbs'],
        instructions: 'Simmer all ingredients'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('italian')
      expect(categories).toContain('vegan')
      expect(categories).toContain('soup')
    })

    it('should handle case variations', () => {
      const recipe = {
        title: 'ITALIAN VEGETARIAN dinner',
        ingredients: ['pasta'],
        instructions: 'Cook pasta'
      }
      const categories = extractTagCategories(recipe)
      expect(categories).toContain('italian')
      expect(categories).toContain('vegetarian')
      expect(categories).toContain('dinner')
    })
  })
}) 