// @ts-nocheck
import { NextRequest } from 'next/server'

// Mock the Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    recipe: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}))

// Mock the tag utilities
jest.mock('@/lib/tag-utils', () => ({
  filterTagSuggestions: jest.fn(),
  findSimilarTags: jest.fn(),
  TagSuggestion: jest.fn()
}))

// Import after mocking
import { GET, POST } from './route'
import { prisma } from '@/lib/prisma'
import { filterTagSuggestions, findSimilarTags } from '@/lib/tag-utils'

// Get the mocked functions
const mockPrismaFindMany = prisma.recipe.findMany as jest.MockedFunction<typeof prisma.recipe.findMany>
const mockPrismaFindUnique = prisma.recipe.findUnique as jest.MockedFunction<typeof prisma.recipe.findUnique>
const mockPrismaUpdate = prisma.recipe.update as jest.MockedFunction<typeof prisma.recipe.update>
const mockFilterTagSuggestions = filterTagSuggestions as jest.MockedFunction<typeof filterTagSuggestions>
const mockFindSimilarTags = findSimilarTags as jest.MockedFunction<typeof findSimilarTags>

// Helper function to create mock requests
function createMockGetRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/tags')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  
  return {
    url: url.toString(),
    method: 'GET'
  } as NextRequest
}

function createMockPostRequest(body: any): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    method: 'POST'
  } as unknown as NextRequest
}

// Sample test data
const sampleRecipes = [
  { id: 1, tags: '["italian", "vegetarian", "pasta"]' },
  { id: 2, tags: '["italian", "meat", "quick"]' },
  { id: 3, tags: '["asian", "vegetarian", "rice"]' },
  { id: 4, tags: '["mexican", "spicy", "vegan"]' }
]

const sampleTagSuggestions = [
  { tag: 'italian', frequency: 2 },
  { tag: 'vegetarian', frequency: 2 },
  { tag: 'pasta', frequency: 1 },
  { tag: 'meat', frequency: 1 },
  { tag: 'quick', frequency: 1 },
  { tag: 'asian', frequency: 1 },
  { tag: 'rice', frequency: 1 },
  { tag: 'mexican', frequency: 1 },
  { tag: 'spicy', frequency: 1 },
  { tag: 'vegan', frequency: 1 }
]

describe('/api/tags GET endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic functionality', () => {
    it('should return tag suggestions when no query provided', async () => {
      mockPrismaFindMany.mockResolvedValue(sampleRecipes as any)
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'italian', frequency: 2 },
        { tag: 'vegetarian', frequency: 2 }
      ])

      const request = createMockGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(2)
      expect(data.suggestions[0].tag).toBe('italian')
      expect(data.totalTags).toBe(10)
      expect(data.query).toBeNull()
    })

    it('should handle search query parameter', async () => {
      mockPrismaFindMany.mockResolvedValue(sampleRecipes as any)
      mockFindSimilarTags.mockReturnValue([
        { tag: 'italian', frequency: 2, similarity: 0.8 }
      ])
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'italian', frequency: 2 }
      ])

      const request = createMockGetRequest({ q: 'ital' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(1)
      expect(data.suggestions[0].tag).toBe('italian')
      expect(data.query).toBe('ital')
      expect(mockFindSimilarTags).toHaveBeenCalledWith('ital', expect.any(Array), 0.3)
    })

    it('should respect limit parameter', async () => {
      mockPrismaFindMany.mockResolvedValue(sampleRecipes as any)
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'italian', frequency: 2 }
      ])

      const request = createMockGetRequest({ limit: '1' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.limit).toBe(1)
      expect(mockFilterTagSuggestions).toHaveBeenCalledWith('', expect.any(Array), 1)
    })

    it('should respect threshold parameter', async () => {
      mockPrismaFindMany.mockResolvedValue(sampleRecipes as any)
      mockFindSimilarTags.mockReturnValue([])
      mockFilterTagSuggestions.mockReturnValue([])

      const request = createMockGetRequest({ q: 'test', threshold: '0.8' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.threshold).toBe(0.8)
      expect(mockFindSimilarTags).toHaveBeenCalledWith('test', expect.any(Array), 0.8)
    })
  })

  describe('Parameter validation', () => {
    it('should reject invalid limit parameter', async () => {
      const request = createMockGetRequest({ limit: '101' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit must be between 1 and 100')
    })

    it('should reject negative limit', async () => {
      const request = createMockGetRequest({ limit: '0' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit must be between 1 and 100')
    })

    it('should reject invalid threshold parameter', async () => {
      const request = createMockGetRequest({ threshold: '1.5' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Threshold must be between 0 and 1')
    })

    it('should reject negative threshold', async () => {
      const request = createMockGetRequest({ threshold: '-0.1' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Threshold must be between 0 and 1')
    })
  })

  describe('Edge cases', () => {
    it('should handle no recipes in database', async () => {
      mockPrismaFindMany.mockResolvedValue([])
      mockFilterTagSuggestions.mockReturnValue([])

      const request = createMockGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(0)
      expect(data.totalTags).toBe(0)
    })

    it('should handle recipes with invalid JSON tags', async () => {
      const recipesWithInvalidTags = [
        { id: 1, tags: 'invalid json' },
        { id: 2, tags: '["valid", "tags"]' }
      ]
      
      mockPrismaFindMany.mockResolvedValue(recipesWithInvalidTags)
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'valid', frequency: 1 },
        { tag: 'tags', frequency: 1 }
      ])

      const request = createMockGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.totalTags).toBe(2) // Only valid tags counted
    })

    it('should handle recipes with empty tag arrays', async () => {
      const recipesWithEmptyTags = [
        { id: 1, tags: '[]' },
        { id: 2, tags: '["some", "tags"]' }
      ]
      
      mockPrismaFindMany.mockResolvedValue(recipesWithEmptyTags)
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'some', frequency: 1 },
        { tag: 'tags', frequency: 1 }
      ])

      const request = createMockGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.totalTags).toBe(2)
    })

    it('should handle database errors gracefully', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockGetRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch tag suggestions')
    })
  })

  describe('User-specific suggestions', () => {
    it('should handle userId parameter', async () => {
      // Mock global recipes
      mockPrismaFindMany.mockResolvedValueOnce(sampleRecipes)
      // Mock user-specific recipes
      mockPrismaFindMany.mockResolvedValueOnce([
        { id: 1, tags: '["italian", "pasta"]' }
      ])
      
      mockFilterTagSuggestions.mockReturnValue([
        { tag: 'italian', frequency: 1 }
      ])

      const request = createMockGetRequest({ userId: 'user123' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrismaFindMany).toHaveBeenCalledTimes(2) // Global + user-specific
    })
  })
})

describe('/api/tags POST endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Successful operations', () => {
    it('should update recipe tags successfully', async () => {
      const mockRecipe = { id: 1, tags: '["old", "tags"]' }
      const updatedRecipe = { id: 1, tags: '["new", "tags"]' }

      mockPrismaFindUnique.mockResolvedValue(mockRecipe)
      mockPrismaUpdate.mockResolvedValue(updatedRecipe)

      const request = createMockPostRequest({
        tags: ['new', 'tags'],
        recipeId: '1',
        userId: 'user123'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Tags updated successfully')
      expect(data.tags).toEqual(['new', 'tags'])
      
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { tags: JSON.stringify(['new', 'tags']) }
      })
    })

    it('should filter out empty tags', async () => {
      const mockRecipe = { id: 1, tags: '[]' }
      const updatedRecipe = { id: 1, tags: '["valid"]' }

      mockPrismaFindUnique.mockResolvedValue(mockRecipe)
      mockPrismaUpdate.mockResolvedValue(updatedRecipe)

      const request = createMockPostRequest({
        tags: ['valid', '', '   ', 'another'],
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { tags: JSON.stringify(['valid', 'another']) }
      })
    })
  })

  describe('Validation errors', () => {
    it('should reject missing tags array', async () => {
      const request = createMockPostRequest({
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tags array is required')
    })

    it('should reject non-array tags', async () => {
      const request = createMockPostRequest({
        tags: 'not an array',
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tags array is required')
    })

    it('should reject missing recipe ID', async () => {
      const request = createMockPostRequest({
        tags: ['some', 'tags']
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Recipe ID is required for tag tracking')
    })

    it('should handle recipe not found', async () => {
      mockPrismaFindUnique.mockResolvedValue(null)

      const request = createMockPostRequest({
        tags: ['some', 'tags'],
        recipeId: '999'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Recipe not found')
    })
  })

  describe('Error handling', () => {
    it('should handle database errors during recipe lookup', async () => {
      mockPrismaFindUnique.mockRejectedValue(new Error('Database error'))

      const request = createMockPostRequest({
        tags: ['some', 'tags'],
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track tag usage')
    })

    it('should handle database errors during recipe update', async () => {
      const mockRecipe = { id: 1, tags: '[]' }
      
      mockPrismaFindUnique.mockResolvedValue(mockRecipe)
      mockPrismaUpdate.mockRejectedValue(new Error('Update failed'))

      const request = createMockPostRequest({
        tags: ['some', 'tags'],
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track tag usage')
    })

    it('should handle malformed JSON in request body', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        method: 'POST'
      } as unknown as NextRequest

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track tag usage')
    })
  })

  describe('Data integrity', () => {
    it('should properly handle special characters in tags', async () => {
      const mockRecipe = { id: 1, tags: '[]' }
      const updatedRecipe = { id: 1, tags: '["café", "naïve", "résumé"]' }

      mockPrismaFindUnique.mockResolvedValue(mockRecipe)
      mockPrismaUpdate.mockResolvedValue(updatedRecipe)

      const request = createMockPostRequest({
        tags: ['café', 'naïve', 'résumé'],
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tags).toEqual(['café', 'naïve', 'résumé'])
    })

    it('should handle large number of tags', async () => {
      const mockRecipe = { id: 1, tags: '[]' }
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`)
      const updatedRecipe = { id: 1, tags: JSON.stringify(manyTags) }

      mockPrismaFindUnique.mockResolvedValue(mockRecipe)
      mockPrismaUpdate.mockResolvedValue(updatedRecipe)

      const request = createMockPostRequest({
        tags: manyTags,
        recipeId: '1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tags).toHaveLength(50)
    })
  })
}) 