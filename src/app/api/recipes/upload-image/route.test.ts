import { NextRequest } from 'next/server'
import { POST } from './route'
import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    recipe: {
      update: jest.fn()
    }
  }))
}))

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn()
}))

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  sep: '/'
}))

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    resize: jest.fn(() => ({
      webp: jest.fn(() => ({
        toBuffer: jest.fn(() => Promise.resolve(Buffer.from('optimized-image-data')))
      }))
    }))
  }))
  return mockSharp
})

// Mock fetch for remote image URL tests
const mockFetch = jest.fn()
global.fetch = mockFetch

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>

describe('/api/recipes/upload-image', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(path.join as jest.Mock).mockImplementation((...args) => args.join('/'))
  })

  describe('File Upload', () => {
    it('successfully uploads and optimizes an image', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-123.webp' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      const formData = new FormData()
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecipe)
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('public/uploads/recipes'),
        { recursive: true }
      )
      expect(fs.writeFile).toHaveBeenCalled()
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { image: expect.stringContaining('/uploads/recipes/recipe-1-') }
      })
    })

    it('returns 400 for missing file', async () => {
      const formData = new FormData()
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing file or recipeId')
    })

    it('returns 400 for missing recipeId', async () => {
      const formData = new FormData()
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing file or recipeId')
    })

    it('returns 400 for invalid file type', async () => {
      const formData = new FormData()
      const file = new File(['image-data'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type')
    })

    it('returns 400 for file too large', async () => {
      const formData = new FormData()
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      formData.append('file', largeFile)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File too large (max 5MB)')
    })

    it('accepts valid image types', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-123.webp' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      const validTypes = ['image/jpeg', 'image/png', 'image/webp']

      for (const type of validTypes) {
        const formData = new FormData()
        const file = new File(['image-data'], `test.${type.split('/')[1]}`, { type })
        formData.append('file', file)
        formData.append('recipeId', '1')

        const req = {
          formData: () => Promise.resolve(formData),
          headers: { get: () => 'multipart/form-data' }
        } as unknown as NextRequest

        const response = await POST(req)
        expect(response.status).toBe(200)
      }
    })

    it('falls back to original file if sharp optimization fails', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-123.jpg' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      // Mock sharp to throw an error
      const sharp = require('sharp')
      sharp.mockImplementation(() => {
        throw new Error('Sharp optimization failed')
      })

      const formData = new FormData()
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecipe)
    })
  })

  describe('Remote Image URL', () => {
    it('successfully downloads and saves remote image', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-remote-123.jpg' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        headers: { get: () => 'image/jpeg' }
      })

      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/image.jpg', recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecipe)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { image: expect.stringContaining('/uploads/recipes/recipe-1-remote-') }
      })
    })

    it('returns 400 for missing imageUrl', async () => {
      const req = {
        json: () => Promise.resolve({ recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing imageUrl or recipeId')
    })

    it('returns 400 for missing recipeId', async () => {
      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/image.jpg' }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing imageUrl or recipeId')
    })

    it('returns 400 when remote image fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      })

      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/notfound.jpg', recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Failed to fetch image from URL')
    })

    it('handles different image extensions from content-type', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-remote-123.png' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        headers: { get: () => 'image/png' }
      })

      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/image.png', recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecipe)
    })

    it('defaults to jpg extension when content-type is missing', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-remote-123.jpg' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        headers: { get: () => null }
      })

      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/image', recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecipe)
    })

    it('returns 500 when remote image processing fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const req = {
        json: () => Promise.resolve({ imageUrl: 'https://example.com/image.jpg', recipeId: 1 }),
        headers: { get: () => 'application/json' }
      } as unknown as NextRequest

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process remote image')
    })
  })

  describe('Database Integration', () => {
    it('updates recipe with image URL', async () => {
      const mockRecipe = { id: 1, title: 'Test Recipe', image: '/uploads/recipes/recipe-1-123.webp' }
      ;(mockPrisma.recipe.update as jest.Mock).mockResolvedValue(mockRecipe)

      const formData = new FormData()
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      await POST(req)

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { image: expect.stringContaining('/uploads/recipes/recipe-1-') }
      })
    })

    it('handles database errors gracefully', async () => {
      ;(mockPrisma.recipe.update as jest.Mock).mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      formData.append('recipeId', '1')

      const req = {
        formData: () => Promise.resolve(formData),
        headers: { get: () => 'multipart/form-data' }
      } as unknown as NextRequest

      const response = await POST(req)

      expect(response.status).toBe(500)
    })
  })
}) 