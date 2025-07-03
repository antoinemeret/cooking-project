import { NextRequest } from 'next/server'
import { PATCH, GET } from './route'

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    recipe: {
      update: jest.fn(),
      findUnique: jest.fn()
    }
  }
}))

const { prisma } = require('@/lib/prisma')

function createMockRequest(body: any): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body)
  } as unknown as NextRequest
}

describe('/api/recipes/[id] PATCH', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates tags for a valid recipe', async () => {
    const id = 42
    const tags = '["vegan","quick"]'
    const updatedRecipe = { id, tags, ingredients: [] }
    prisma.recipe.update.mockResolvedValue(updatedRecipe)

    const req = createMockRequest({ tags })
    const res = await PATCH(req, { params: { id: String(id) } })
    const data = await res.json()

    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id },
      data: { tags },
      include: { ingredients: true }
    })
    expect(res.status).toBe(200)
    expect(data.recipe).toEqual(updatedRecipe)
  })

  it('returns 400 for invalid recipe ID', async () => {
    const req = createMockRequest({ tags: '["vegan"]' })
    const res = await PATCH(req, { params: { id: 'not-a-number' } })
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Invalid recipe ID/)
  })

  it('returns 400 if tags field is missing', async () => {
    const req = createMockRequest({})
    const res = await PATCH(req, { params: { id: '1' } })
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Tags field is required/)
  })

  it('returns 500 if update throws', async () => {
    prisma.recipe.update.mockRejectedValue(new Error('DB error'))
    const req = createMockRequest({ tags: '["vegan"]' })
    const res = await PATCH(req, { params: { id: '1' } })
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toMatch(/Failed to update recipe/)
  })
})

describe('/api/recipes/[id] GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns recipe with tags for valid ID', async () => {
    const id = 42
    const recipe = { id, tags: '["vegan"]', ingredients: [] }
    prisma.recipe.findUnique.mockResolvedValue(recipe)

    const req = {} as NextRequest
    const res = await GET(req, { params: { id: String(id) } })
    const data = await res.json()
    expect(prisma.recipe.findUnique).toHaveBeenCalledWith({
      where: { id },
      include: { ingredients: true }
    })
    expect(res.status).toBe(200)
    expect(data.recipe).toEqual(recipe)
  })

  it('returns 400 for invalid recipe ID', async () => {
    const req = {} as NextRequest
    const res = await GET(req, { params: { id: 'not-a-number' } })
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/Invalid recipe ID/)
  })

  it('returns 404 if recipe not found', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null)
    const req = {} as NextRequest
    const res = await GET(req, { params: { id: '123' } })
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.error).toMatch(/Recipe not found/)
  })

  it('returns 500 if findUnique throws', async () => {
    prisma.recipe.findUnique.mockRejectedValue(new Error('DB error'))
    const req = {} as NextRequest
    const res = await GET(req, { params: { id: '1' } })
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toMatch(/Failed to fetch recipe/)
  })
}) 