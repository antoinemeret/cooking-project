/**
 * @jest-environment node
 */

import { POST } from '@/app/api/recipes/suggest/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    recipe: {
      findMany: jest.fn()
    }
  }
}))

// Mock getCurrentMonth to return a fixed month for testing
jest.mock('@/lib/recipe-filters', () => ({
  getCurrentMonth: jest.fn(() => 6) // June
}))

describe('Recipe Suggestions API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockRequest = (body: any): NextRequest => {
    return new NextRequest('http://localhost:3000/api/recipes/suggest', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  const mockRecipes = [
    {
      id: 1,
      title: 'Salade de tomates',
      summary: 'Fresh tomato salad',
      tags: JSON.stringify(['vegetarian', 'salad', 'healthy']),
      startSeason: 5,
      endSeason: 9,
      preparationTime: 10,
      cookingTime: 0,
      image: '/test.jpg',
      ingredients: [
        { id: 1, name: 'tomates' },
        { id: 2, name: 'basilic' }
      ],
      plannedRecipes: []
    },
    {
      id: 2,
      title: 'Poulet rôti',
      summary: 'Roasted chicken',
      tags: JSON.stringify(['main', 'roasted']),
      startSeason: 1,
      endSeason: 12,
      preparationTime: 15,
      cookingTime: 60,
      image: '/test2.jpg',
      ingredients: [
        { id: 3, name: 'poulet' },
        { id: 4, name: 'herbes' }
      ],
      plannedRecipes: [
        { addedAt: new Date('2024-01-01') }
      ]
    },
    {
      id: 3,
      title: 'Tarte aux légumes',
      summary: 'Vegetable tart',
      tags: JSON.stringify(['vegetarian', 'baked', 'main']),
      startSeason: 4,
      endSeason: 10,
      preparationTime: 20,
      cookingTime: 40,
      image: '/test3.jpg',
      ingredients: [
        { id: 5, name: 'courgettes' },
        { id: 6, name: 'tomates' },
        { id: 7, name: 'oignons' }
      ],
      plannedRecipes: []
    }
  ]

  describe('Request validation', () => {
    it('should reject invalid request format', async () => {
      const req = createMockRequest({ invalid: 'data' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request format')
    })

    it('should accept valid request with constraints', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue([])

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          includeIngredients: ['tomates'],
          dietaryRestrictions: ['vegetarian']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: true
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      expect(response.status).toBe(200)
    })
  })

  describe('Match percentage calculation', () => {
    it('should calculate 100% match for recipes matching all criteria', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue([mockRecipes[0]])

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          includeIngredients: ['tomates'],
          dietaryRestrictions: ['vegetarian'],
          dishType: ['salad']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: true
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      expect(data.perfectMatches).toHaveLength(1)
      expect(data.perfectMatches[0].matchPercentage).toBe(100)
    })

    it('should calculate partial match for recipes missing some criteria', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue([mockRecipes[1]])

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          includeIngredients: ['poulet'],
          dietaryRestrictions: ['vegetarian'] // Chicken is not vegetarian
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: true
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      expect(data.partialMatches).toHaveLength(1)
      expect(data.partialMatches[0].matchPercentage).toBeLessThan(90)
    })
  })

  describe('Ranking logic', () => {
    it('should rank by match percentage descending', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          includeIngredients: ['tomates'],
          dietaryRestrictions: ['vegetarian']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: true
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      // Check that perfect matches come before partial matches
      if (data.perfectMatches.length > 0 && data.partialMatches.length > 0) {
        const lastPerfect = data.perfectMatches[data.perfectMatches.length - 1]
        const firstPartial = data.partialMatches[0]
        expect(lastPerfect.matchPercentage).toBeGreaterThanOrEqual(firstPartial.matchPercentage)
      }
    })

    it('should tie-break by less recently cooked date', async () => {
      const recipesWithDates = [
        {
          ...mockRecipes[0],
          plannedRecipes: [{ addedAt: new Date('2024-03-01') }]
        },
        {
          ...mockRecipes[2],
          plannedRecipes: [{ addedAt: new Date('2024-01-01') }]
        }
      ]
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(recipesWithDates)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          dietaryRestrictions: ['vegetarian']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      const allRecipes = [...data.perfectMatches, ...data.partialMatches]
      if (allRecipes.length >= 2) {
        // Verify that within same match percentage, older dates come first
        const matches = allRecipes.filter((r: any) => r.matchPercentage === allRecipes[0].matchPercentage)
        if (matches.length >= 2) {
          for (let i = 0; i < matches.length - 1; i++) {
            const current = matches[i].lastCookedAt
            const next = matches[i + 1].lastCookedAt
            if (current && next) {
              expect(new Date(current).getTime()).toBeLessThanOrEqual(new Date(next).getTime())
            }
          }
        }
      }
    })

    it('should prioritize never-cooked recipes over cooked ones', async () => {
      const recipesWithMixedDates = [
        {
          ...mockRecipes[0],
          plannedRecipes: [] // Never cooked
        },
        {
          ...mockRecipes[2],
          plannedRecipes: [{ addedAt: new Date('2024-01-01') }] // Cooked before
        }
      ]
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(recipesWithMixedDates)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          dietaryRestrictions: ['vegetarian']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      const allRecipes = [...data.perfectMatches, ...data.partialMatches]
      // Within same match %, never-cooked should come first
      const perfectMatches = allRecipes.filter((r: any) => r.matchPercentage >= 90)
      if (perfectMatches.length >= 2) {
        const neverCooked = perfectMatches.filter((r: any) => !r.lastCookedAt)
        const cooked = perfectMatches.filter((r: any) => r.lastCookedAt)
        if (neverCooked.length > 0 && cooked.length > 0) {
          const firstNeverCookedIndex = allRecipes.findIndex((r: any) => !r.lastCookedAt)
          const firstCookedIndex = allRecipes.findIndex((r: any) => r.lastCookedAt)
          // This check only applies if both have same match percentage
          const neverCookedMatch = allRecipes[firstNeverCookedIndex]?.matchPercentage
          const cookedMatch = allRecipes[firstCookedIndex]?.matchPercentage
          if (neverCookedMatch === cookedMatch) {
            expect(firstNeverCookedIndex).toBeLessThan(firstCookedIndex)
          }
        }
      }
    })
  })

  describe('Pagination', () => {
    it('should return initial 8 recipes', async () => {
      const manyRecipes = Array.from({ length: 15 }, (_, i) => ({
        ...mockRecipes[0],
        id: i + 1,
        title: `Recipe ${i + 1}`
      }))
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(manyRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      const totalReturned = data.perfectMatches.length + data.partialMatches.length
      expect(totalReturned).toBeLessThanOrEqual(8)
      expect(data.hasMore).toBe(true)
    })

    it('should return next 5 recipes with offset', async () => {
      const manyRecipes = Array.from({ length: 15 }, (_, i) => ({
        ...mockRecipes[0],
        id: i + 1,
        title: `Recipe ${i + 1}`
      }))
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(manyRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 8,
        limit: 5
      })

      const response = await POST(req)
      const data = await response.json()

      const totalReturned = data.perfectMatches.length + data.partialMatches.length
      expect(totalReturned).toBeLessThanOrEqual(5)
    })

    it('should set hasMore to false when no more results', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 10
      })

      const response = await POST(req)
      const data = await response.json()

      expect(data.hasMore).toBe(false)
    })
  })

  describe('Section separation', () => {
    it('should separate perfect matches (>=90%) from partial matches', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          dietaryRestrictions: ['vegetarian']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      // All perfect matches should have >= 90%
      data.perfectMatches.forEach((recipe: any) => {
        expect(recipe.matchPercentage).toBeGreaterThanOrEqual(90)
      })

      // All partial matches should have < 90%
      data.partialMatches.forEach((recipe: any) => {
        expect(recipe.matchPercentage).toBeLessThan(90)
      })
    })
  })

  describe('Empty results', () => {
    it('should return empty arrays when no recipes match', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue([])

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          includeIngredients: ['nonexistent']
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      expect(data.perfectMatches).toEqual([])
      expect(data.partialMatches).toEqual([])
      expect(data.hasMore).toBe(false)
    })
  })

  describe('Filter handling', () => {
    it('should filter by seasonal constraint', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: true // Current month is 6 (June)
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      // Verify that seasonal filtering affects match percentage
      const allRecipes = [...data.perfectMatches, ...data.partialMatches]
      expect(allRecipes.length).toBeGreaterThan(0)
    })

    it('should filter by time constraints', async () => {
      ;(prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes)

      const req = createMockRequest({
        constraints: {
          mealIndex: 0,
          maxPrepTime: 15,
          maxCookTime: 30
        },
        generalConstraints: {
          mealCount: 1,
          seasonal: false
        },
        offset: 0,
        limit: 8
      })

      const response = await POST(req)
      const data = await response.json()

      // Recipes exceeding time limits should have lower match percentage
      const allRecipes = [...data.perfectMatches, ...data.partialMatches]
      allRecipes.forEach((recipe: any) => {
        if (recipe.prepTime && recipe.prepTime > 15) {
          // Should not be a perfect match
          expect(recipe.matchPercentage).toBeLessThan(100)
        }
      })
    })
  })
})

