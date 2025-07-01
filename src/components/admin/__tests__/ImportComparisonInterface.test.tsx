import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImportComparisonInterface } from '../ImportComparisonInterface'
import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock successful API response
const mockSuccessResponse = {
  success: true,
  comparisonId: 'test-id-123',
  results: {
    ollama: {
      success: true,
      recipe: {
        title: 'Test Ollama Recipe',
        ingredients: ['1 cup flour', '2 eggs'],
        instructions: ['Mix ingredients', 'Cook for 20 minutes'],
        summary: null,
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      },
      error: null,
      processingTime: 2500,
      parsingMethod: 'ollama' as const,
      extractedRawData: {}
    },
    traditional: {
      success: true,
      recipe: {
        title: 'Test Traditional Recipe',
        ingredients: ['2 cups sugar', '3 tbsp butter'],
        instructions: ['Combine all ingredients', 'Bake at 350F'],
        summary: null,
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      },
      error: null,
      processingTime: 1200,
      parsingMethod: 'json-ld' as const,
      extractedRawData: {}
    }
  }
}

describe('ImportComparisonInterface', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders the URL input form', () => {
      render(<ImportComparisonInterface />)
      
      expect(screen.getByLabelText(/recipe url to compare/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/https:\/\/example.com\/recipe/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
    })

    it('renders the compare button as disabled when URL is empty', () => {
      render(<ImportComparisonInterface />)
      
      const compareButton = screen.getByRole('button', { name: /compare/i })
      expect(compareButton).toBeDisabled()
    })

    it('enables compare button when valid URL is entered', () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      
      expect(compareButton).not.toBeDisabled()
    })
  })

  describe('Form Interactions', () => {
    it('updates URL input value when typing', () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      
      fireEvent.change(urlInput, { target: { value: 'https://test.com/recipe' } })
      
      expect(urlInput).toHaveValue('https://test.com/recipe')
    })

    it('shows helper text when URL is entered', () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      
      expect(screen.getByText(/this will test both ollama and traditional parsing/i)).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('makes API call with correct parameters when form is submitted', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      expect(mockFetch).toHaveBeenCalledWith('/api/recipes/import-comparison', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://example.com/recipe' })
      })
    })

    it('shows loading state during API call', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      expect(screen.getByText(/comparing\.\.\./i)).toBeInTheDocument()
      expect(screen.getByText(/running comparison tests\.\.\./i)).toBeInTheDocument()
    })
  })

  describe('Successful Results Display', () => {
    it('displays comparison results after successful API call', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      await waitFor(() => {
        expect(screen.getByText(/comparison results/i)).toBeInTheDocument()
      })
    })

    it('displays both Ollama and Traditional results', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      await waitFor(() => {
        expect(screen.getByText(/ollama llm/i)).toBeInTheDocument()
        expect(screen.getByText(/traditional parser/i)).toBeInTheDocument()
        expect(screen.getByText(/test ollama recipe/i)).toBeInTheDocument()
        expect(screen.getByText(/test traditional recipe/i)).toBeInTheDocument()
      })
    })

    it('shows reset button after results are displayed', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
      })
    })
  })

  describe('Reset Functionality', () => {
    it('clears form and results when reset button is clicked', async () => {
      render(<ImportComparisonInterface />)
      
      const urlInput = screen.getByLabelText(/recipe url to compare/i)
      const compareButton = screen.getByRole('button', { name: /compare/i })
      
      // Submit form and get results
      fireEvent.change(urlInput, { target: { value: 'https://example.com/recipe' } })
      fireEvent.click(compareButton)
      
      await waitFor(() => {
        expect(screen.getByText(/comparison results/i)).toBeInTheDocument()
      })
      
      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i })
      fireEvent.click(resetButton)
      
      // Form should be cleared
      expect(urlInput).toHaveValue('')
      expect(screen.queryByText(/comparison results/i)).not.toBeInTheDocument()
    })
  })
}) 