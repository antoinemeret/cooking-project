/**
 * Integration Tests for URL Import Comparison Workflow
 * 
 * These tests verify the end-to-end functionality of the comparison system,
 * from URL submission through result storage and evaluation.
 * 
 * Note: These tests require Jest setup and a test database configuration.
 */

import { NextRequest } from 'next/server'
import { POST as comparisonHandler } from '@/app/api/recipes/import-comparison/route'
import { POST as evaluationHandler, GET as getEvaluationHandler } from '@/app/api/recipes/import-comparison/evaluate/route'
import { GET as dashboardHandler } from '@/app/api/recipes/import-comparison/dashboard/route'
import { TEST_DATASETS } from '@/data/test-dataset'
import { calculateOverallScore } from '@/lib/evaluation-criteria'

// Mock external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    comparisonResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    comparisonEvaluation: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    performanceMetrics: {
      upsert: jest.fn(),
      findUnique: jest.fn()
    }
  }
}))

// Mock fetch for external URL requests
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('Comparison Workflow Integration Tests', () => {
  const testUrl = 'https://example.com/test-recipe'
  const mockHtmlContent = `
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": "Test Recipe",
          "recipeIngredient": ["1 cup flour", "2 eggs"],
          "recipeInstructions": [
            {"@type": "HowToStep", "text": "Mix ingredients"},
            {"@type": "HowToStep", "text": "Bake for 30 minutes"}
          ]
        }
        </script>
      </head>
      <body>
        <h1>Test Recipe</h1>
        <ul>
          <li>1 cup flour</li>
          <li>2 eggs</li>
        </ul>
        <ol>
          <li>Mix ingredients</li>
          <li>Bake for 30 minutes</li>
        </ol>
      </body>
    </html>
  `

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful HTML fetch
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtmlContent,
      headers: new Headers({ 'content-type': 'text/html' })
    } as Response)

    // Mock Ollama API
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlString = url.toString()
      
      if (urlString.includes('localhost:11434')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: JSON.stringify({
              title: 'Test Recipe',
              rawIngredients: ['1 cup flour', '2 eggs'],
              instructions: 'Mix ingredients. Bake for 30 minutes.',
              url: testUrl
            })
          })
        } as Response)
      }
      
      // Default to HTML content fetch
      return Promise.resolve({
        ok: true,
        text: async () => mockHtmlContent,
        headers: new Headers({ 'content-type': 'text/html' })
      } as Response)
    })
  })

  describe('Complete Comparison Workflow', () => {
    it('should execute full comparison workflow successfully', async () => {
      // Step 1: Submit comparison request
      const comparisonRequest = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl })
      })

      const comparisonResponse = await comparisonHandler(comparisonRequest)
      const comparisonData = await comparisonResponse.json()

      // Verify comparison response structure
      expect(comparisonResponse.status).toBe(200)
      expect(comparisonData.success).toBe(true)
      expect(comparisonData.comparisonId).toBeDefined()
      expect(comparisonData.results).toHaveProperty('ollama')
      expect(comparisonData.results).toHaveProperty('traditional')

      // Verify both technologies processed
      expect(comparisonData.results.ollama.success).toBe(true)
      expect(comparisonData.results.traditional.success).toBe(true)
      expect(comparisonData.results.ollama.processingTime).toBeGreaterThan(0)
      expect(comparisonData.results.traditional.processingTime).toBeGreaterThan(0)

      // Step 2: Submit evaluations for both technologies
      const { comparisonId } = comparisonData

      // Mock successful database operations for evaluation
      const mockEvaluation = {
        id: 1,
        comparisonId,
        technology: 'ollama',
        titleAccurate: true,
        ingredientsAccurate: true,
        instructionsAccurate: true,
        overallSuccess: true,
        evaluatedAt: new Date(),
        evaluatorNotes: 'Perfect extraction'
      }

      const { prisma } = await import('@/lib/prisma')
      ;(prisma.comparisonResult.findUnique as jest.Mock).mockResolvedValue({ id: comparisonId })
      ;(prisma.comparisonEvaluation.upsert as jest.Mock).mockResolvedValue(mockEvaluation)

      // Submit Ollama evaluation
      const ollamaEvalRequest = new NextRequest('http://localhost:3000/api/recipes/import-comparison/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          comparisonId,
          technology: 'ollama',
          evaluation: {
            titleAccurate: true,
            ingredientsAccurate: true,
            instructionsAccurate: true,
            overallSuccess: true,
            evaluatorNotes: 'Perfect extraction'
          }
        })
      })

      const ollamaEvalResponse = await evaluationHandler(ollamaEvalRequest)
      const ollamaEvalData = await ollamaEvalResponse.json()

      expect(ollamaEvalResponse.status).toBe(200)
      expect(ollamaEvalData.success).toBe(true)
      expect(ollamaEvalData.updatedEvaluation.overallSuccess).toBe(true)

      // Submit Traditional evaluation
      const traditionalEvalRequest = new NextRequest('http://localhost:3000/api/recipes/import-comparison/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          comparisonId,
          technology: 'traditional',
          evaluation: {
            titleAccurate: true,
            ingredientsAccurate: false,
            instructionsAccurate: true,
            overallSuccess: false,
            evaluatorNotes: 'Missing ingredient quantities'
          }
        })
      })

      const traditionalEvalResponse = await evaluationHandler(traditionalEvalRequest)
      const traditionalEvalData = await traditionalEvalResponse.json()

      expect(traditionalEvalResponse.status).toBe(200)
      expect(traditionalEvalData.success).toBe(true)
      expect(traditionalEvalData.updatedEvaluation.overallSuccess).toBe(false)

      // Step 3: Retrieve evaluations
      const getEvalRequest = new NextRequest(`http://localhost:3000/api/recipes/import-comparison/evaluate?comparisonId=${comparisonId}`)
      
      ;(prisma.comparisonEvaluation.findMany as jest.Mock).mockResolvedValue([
        { ...mockEvaluation, technology: 'ollama' },
        { ...mockEvaluation, technology: 'traditional', overallSuccess: false }
      ])

      const getEvalResponse = await getEvaluationHandler(getEvalRequest)
      const getEvalData = await getEvalResponse.json()

      expect(getEvalResponse.status).toBe(200)
      expect(getEvalData.success).toBe(true)
      expect(getEvalData.evaluations).toHaveProperty('ollama')
      expect(getEvalData.evaluations).toHaveProperty('traditional')
      expect(getEvalData.evaluations.ollama.overallSuccess).toBe(true)
      expect(getEvalData.evaluations.traditional.overallSuccess).toBe(false)
    })

    it('should handle comparison failures gracefully', async () => {
      // Mock network failure
      mockFetch.mockRejectedValue(new Error('Network error'))

      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://invalid-url.com/recipe' })
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Network error')
    })

    it('should validate evaluation requests properly', async () => {
      // Test invalid evaluation request
      const invalidRequest = new NextRequest('http://localhost:3000/api/recipes/import-comparison/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          comparisonId: 'invalid-id',
          technology: 'invalid-tech',
          evaluation: {}
        })
      })

      const response = await evaluationHandler(invalidRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid request')
    })
  })

  describe('Test Dataset Integration', () => {
    it('should process test dataset URLs correctly', async () => {
      const quickValidationSet = TEST_DATASETS['quick-validation']
      
      expect(quickValidationSet.urls.length).toBeGreaterThan(0)
      expect(quickValidationSet.urls.length).toBeLessThanOrEqual(4)

      // Process first URL from test dataset
      const testUrl = quickValidationSet.urls[0]
      
      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl.url })
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.comparisonId).toBeDefined()

      // Verify expected recipe structure matches
      expect(testUrl.expectedRecipe.title).toBeDefined()
      expect(testUrl.expectedRecipe.ingredients).toBeDefined()
      expect(Array.isArray(testUrl.expectedRecipe.ingredients)).toBe(true)
    })

    it('should categorize websites correctly', async () => {
      const comprehensiveSet = TEST_DATASETS['comprehensive']
      
      // Verify we have URLs from different categories
      const websites = comprehensiveSet.urls.map(url => url.websiteName)
      const uniqueWebsites = [...new Set(websites)]
      
      expect(uniqueWebsites.length).toBeGreaterThan(5)
      expect(websites).toContain('Food Network')
      expect(websites).toContain('Allrecipes')
      expect(websites).toContain('Budget Bytes')
    })
  })

  describe('Performance Measurement', () => {
    it('should measure and compare processing times', async () => {
      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl })
      })

      const startTime = Date.now()
      const response = await comparisonHandler(request)
      const totalTime = Date.now() - startTime
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results.ollama.processingTime).toBeGreaterThan(0)
      expect(data.results.traditional.processingTime).toBeGreaterThan(0)
      expect(totalTime).toBeGreaterThan(data.results.ollama.processingTime)
      expect(totalTime).toBeGreaterThan(data.results.traditional.processingTime)

      // Verify parallel processing (total time should be close to max individual time)
      const maxIndividualTime = Math.max(
        data.results.ollama.processingTime,
        data.results.traditional.processingTime
      )
      expect(totalTime).toBeLessThan(maxIndividualTime + 1000) // 1 second overhead allowance
    })
  })

  describe('Data Storage and Retrieval', () => {
    it('should store comparison results in database', async () => {
      const { prisma } = await import('@/lib/prisma')
      const mockCreate = prisma.comparisonResult.create as jest.Mock
      
      mockCreate.mockResolvedValue({
        id: 'test-comparison-id',
        url: testUrl,
        timestamp: new Date()
      })

      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl })
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          url: testUrl,
          timestamp: expect.any(Date),
          ollamaResult: expect.any(String),
          traditionalResult: expect.any(String),
          status: 'pending'
        })
      })
    })
  })

  describe('Error Scenarios', () => {
    it('should handle invalid URLs gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: 'not-a-valid-url' })
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid request')
    })

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: ''
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should handle Ollama service unavailable', async () => {
      // Mock Ollama service failure
      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlString = url.toString()
        
        if (urlString.includes('localhost:11434')) {
          return Promise.reject(new Error('Connection refused'))
        }
        
        return Promise.resolve({
          ok: true,
          text: async () => mockHtmlContent,
          headers: new Headers({ 'content-type': 'text/html' })
        } as Response)
      })

      const request = new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl })
      })

      const response = await comparisonHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Should still succeed with traditional parsing
      expect(data.success).toBe(true)
      expect(data.results.ollama.success).toBe(false)
      expect(data.results.traditional.success).toBe(true)
      expect(data.results.ollama.error).toContain('Connection refused')
    })
  })

  describe('Evaluation Scoring', () => {
    it('should calculate evaluation scores correctly', () => {
      const perfectScores = [
        { field: 'title' as const, score: true, confidence: 'high' as const },
        { field: 'ingredients' as const, score: true, confidence: 'high' as const },
        { field: 'instructions' as const, score: true, confidence: 'high' as const },
        { field: 'overall' as const, score: true, confidence: 'high' as const }
      ]

      const overallScore = calculateOverallScore(perfectScores)
      expect(overallScore).toBe(1.0)

      const partialScores = [
        { field: 'title' as const, score: true, confidence: 'high' as const },
        { field: 'ingredients' as const, score: false, confidence: 'high' as const },
        { field: 'instructions' as const, score: true, confidence: 'high' as const },
        { field: 'overall' as const, score: false, confidence: 'high' as const }
      ]

      const partialScore = calculateOverallScore(partialScores)
      expect(partialScore).toBe(0.5) // 25% (title) + 25% (instructions) = 50%
    })
  })
})

describe('Load Testing', () => {
  it('should handle multiple concurrent requests', async () => {
    const concurrentRequests = 5
    const requests = Array.from({ length: concurrentRequests }, (_, i) => {
      return comparisonHandler(new NextRequest('http://localhost:3000/api/recipes/import-comparison', {
        method: 'POST',
        body: JSON.stringify({ url: `https://example.com/recipe-${i}` })
      }))
    })

    const responses = await Promise.all(requests)
    
    responses.forEach(response => {
      expect(response.status).toBe(200)
    })

    const responseData = await Promise.all(responses.map(r => r.json()))
    responseData.forEach(data => {
      expect(data.success).toBe(true)
      expect(data.comparisonId).toBeDefined()
    })
  })
})

// Helper function to create mock request
function createMockRequest(path: string, method: string = 'GET', body?: any): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined
  })
} 