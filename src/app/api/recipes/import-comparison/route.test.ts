import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock the traditional parser
jest.mock('@/lib/scrapers/traditional-parser', () => ({
  parseTraditional: jest.fn()
}))

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}))

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
const mockParseTraditional = jest.requireMock('@/lib/scrapers/traditional-parser').parseTraditional

// Mock console methods to avoid cluttering test output
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

beforeAll(() => {
  global.console = { ...global.console, ...mockConsole }
})

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockClear()
  mockParseTraditional.mockClear()
})

// Helper function to create mock request
function createMockRequest(body: any): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body)
  } as unknown as NextRequest
}

// Helper function to create mock HTML response
function createMockHTMLResponse(html: string) {
  return {
    ok: true,
    text: jest.fn().mockResolvedValue(html),
    headers: {
      get: jest.fn().mockReturnValue('text/html')
    }
  }
}

// Helper function to create mock Ollama response
function createMockOllamaResponse(response: string) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ response })
  }
}

describe('/api/recipes/import-comparison', () => {
  const sampleHTML = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Test Recipe",
            "recipeIngredient": ["ingredient1", "ingredient2"],
            "recipeInstructions": [{"text": "instruction1"}]
          }
        </script>
      </head>
      <body>
        <h1>Test Recipe</h1>
        <div>Sample recipe content</div>
      </body>
    </html>
  `

  describe('Request Validation', () => {
    it('should reject request without URL', async () => {
      const request = createMockRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid request: missing or invalid URL')
      expect(data.comparisonId).toBe('mock-uuid-123')
    })

    it('should reject request with invalid URL', async () => {
      const request = createMockRequest({ url: 'not-a-valid-url' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid request: missing or invalid URL')
    })

    it('should reject request with non-string URL', async () => {
      const request = createMockRequest({ url: 123 })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should accept valid URL', async () => {
      const validUrl = 'https://example.com/recipe'
      
      // Mock successful HTML fetch
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe","rawIngredients":["ollama ingredient"],"instructions":"ollama instructions"}') as Response)

      // Mock successful traditional parsing
      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: {
          title: 'Traditional Recipe',
          ingredients: ['traditional ingredient'],
          instructions: ['traditional instruction'],
          summary: null,
          cookingTime: null,
          servings: null,
          difficulty: null,
          cuisine: null,
          tags: []
        },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url: validUrl })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('HTML Fetching', () => {
    it('should handle HTTP errors when fetching URL', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Page not found')
      } as unknown as Response)

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Comparison failed')
    })

    it('should handle network errors when fetching URL', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Network error')
    })

    it('should fetch HTML with proper headers', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Test"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Test', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      await POST(request)

      expect(mockFetch).toHaveBeenCalledWith(url, expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Mozilla'),
          'Accept': expect.stringContaining('text/html')
        }),
        signal: expect.any(AbortSignal)
      }))
    })
  })

  describe('Parallel Processing', () => {
    it('should run both Ollama and traditional parsing in parallel', async () => {
      const url = 'https://example.com/recipe'
      
      // Mock HTML fetch
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe","rawIngredients":["ollama ingredient"],"instructions":"ollama instructions"}') as Response)

      // Mock traditional parsing with delay to test parallelism
      mockParseTraditional.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            recipe: {
              title: 'Traditional Recipe',
              ingredients: ['traditional ingredient'],
              instructions: ['traditional instruction'],
              summary: null,
              cookingTime: null,
              servings: null,
              difficulty: null,
              cuisine: null,
              tags: []
            },
            error: null,
            processingTime: 200,
            parsingMethod: 'json-ld'
          }), 10)
        )
      )

      const startTime = Date.now()
      const request = createMockRequest({ url })
      const response = await POST(request)
      const endTime = Date.now()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.ollama).toBeDefined()
      expect(data.results.traditional).toBeDefined()
      
      // Should complete faster than sequential processing
      expect(endTime - startTime).toBeLessThan(500) // Much less than 200ms + Ollama time
    })

    it('should handle when one parsing method fails', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe"}') as Response)

      // Traditional parsing fails
      mockParseTraditional.mockRejectedValue(new Error('Traditional parsing failed'))

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.ollama.success).toBe(true)
      expect(data.results.traditional.success).toBe(false)
      expect(data.results.traditional.error).toContain('Traditional parsing failed')
    })

    it('should handle when both parsing methods fail', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockRejectedValueOnce(new Error('Ollama failed'))

      mockParseTraditional.mockRejectedValue(new Error('Traditional parsing failed'))

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.ollama.success).toBe(false)
      expect(data.results.traditional.success).toBe(false)
    })
  })

  describe('Ollama Integration', () => {
    it('should parse Ollama JSON response correctly', async () => {
      const url = 'https://example.com/recipe'
      const ollamaResponse = {
        title: 'Ollama Recipe Title',
        rawIngredients: ['1 cup flour', '2 eggs'],
        instructions: 'Mix ingredients and bake',
        url: url
      }
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse(JSON.stringify(ollamaResponse)) as Response)

      mockParseTraditional.mockResolvedValue({
        success: false,
        recipe: null,
        error: 'No structured data',
        processingTime: 50,
        parsingMethod: 'failed'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.ollama.success).toBe(true)
      expect(data.results.ollama.recipe.title).toBe('Ollama Recipe Title')
      expect(data.results.ollama.recipe.ingredients).toEqual(['1 cup flour', '2 eggs'])
      expect(data.results.ollama.recipe.instructions).toEqual(['Mix ingredients and bake'])
      expect(data.results.ollama.parsingMethod).toBe('ollama')
    })

    it('should handle malformed Ollama JSON response', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('invalid json {') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Traditional Recipe', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.ollama.success).toBe(false)
      expect(data.results.ollama.error).toContain('failed to extract meaningful recipe data')
    })

    it('should handle empty Ollama response', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Traditional Recipe', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.ollama.success).toBe(false)
      expect(data.results.ollama.recipe).toBeNull()
    })
  })

  describe('Traditional Parsing Integration', () => {
    it('should use traditional parsing results correctly', async () => {
      const url = 'https://example.com/recipe'
      const traditionalResult = {
        success: true,
        recipe: {
          title: 'Traditional Recipe Title',
          ingredients: ['traditional ingredient 1', 'traditional ingredient 2'],
          instructions: ['step 1', 'step 2'],
          summary: 'Recipe description',
          cookingTime: 30,
          servings: 4,
          difficulty: 'easy',
          cuisine: 'Italian',
          tags: ['tag1', 'tag2']
        },
        error: null,
        processingTime: 150,
        parsingMethod: 'json-ld',
        extractedRawData: { source: 'json-ld' }
      }
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{}') as Response)

      mockParseTraditional.mockResolvedValue(traditionalResult)

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.traditional).toEqual(traditionalResult)
      expect(data.results.traditional.recipe.title).toBe('Traditional Recipe Title')
      expect(data.results.traditional.recipe.cookingTime).toBe(30)
      expect(data.results.traditional.parsingMethod).toBe('json-ld')
    })

    it('should handle traditional parsing failure', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: false,
        recipe: null,
        error: 'No recipe data found',
        processingTime: 80,
        parsingMethod: 'failed'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.traditional.success).toBe(false)
      expect(data.results.traditional.error).toBe('No recipe data found')
      expect(data.results.traditional.parsingMethod).toBe('failed')
    })
  })

  describe('Performance Tracking', () => {
    it('should track processing times for both methods', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Traditional Recipe', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 250,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data.results.ollama.processingTime).toBeGreaterThan(0)
      expect(data.results.traditional.processingTime).toBe(250)
      expect(typeof data.results.ollama.processingTime).toBe('number')
      expect(typeof data.results.traditional.processingTime).toBe('number')
    })
  })

  describe('Response Structure', () => {
    it('should return properly structured response on success', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Ollama Recipe"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Traditional Recipe', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('comparisonId', 'mock-uuid-123')
      expect(data).toHaveProperty('results')
      expect(data.results).toHaveProperty('ollama')
      expect(data.results).toHaveProperty('traditional')
      expect(data).not.toHaveProperty('error')
    })

    it('should include comparison ID in all responses', async () => {
      const request = createMockRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(data.comparisonId).toBe('mock-uuid-123')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parsing errors in request', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid JSON')
    })

    it('should handle critical errors gracefully', async () => {
      const url = 'https://example.com/recipe'
      
      // Mock fetch to throw a critical error
      mockFetch.mockRejectedValue(new Error('Critical system error'))

      const request = createMockRequest({ url })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Critical system error')
      expect(data.results.ollama.success).toBe(false)
      expect(data.results.traditional.success).toBe(false)
    })
  })

  describe('Logging', () => {
    it('should log comparison start and completion', async () => {
      const url = 'https://example.com/recipe'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Test"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Test', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      await POST(request)

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[Import Comparison API] Import comparison request started'),
        expect.any(String)
      )
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[Import Comparison API] Comparison completed'),
        expect.any(String)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large HTML content', async () => {
      const url = 'https://example.com/recipe'
      const largeHTML = 'a'.repeat(1000000) + sampleHTML // 1MB+ HTML
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(largeHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Test"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Test', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'html-parsing'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle URLs with special characters', async () => {
      const url = 'https://example.com/recipe?search=café&category=entrée'
      
      mockFetch
        .mockResolvedValueOnce(createMockHTMLResponse(sampleHTML) as Response)
        .mockResolvedValueOnce(createMockOllamaResponse('{"title":"Test"}') as Response)

      mockParseTraditional.mockResolvedValue({
        success: true,
        recipe: { title: 'Test', ingredients: [], instructions: [], summary: null, cookingTime: null, servings: null, difficulty: null, cuisine: null, tags: [] },
        error: null,
        processingTime: 100,
        parsingMethod: 'json-ld'
      })

      const request = createMockRequest({ url })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
}) 