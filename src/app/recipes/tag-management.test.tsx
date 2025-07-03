import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { DataTable } from './data-table'

// Mock the TagInput component with more realistic behavior
jest.mock('@/components/ui/tag-input', () => ({
  TagInput: ({ tags, onTagsChange, placeholder, disabled, getSuggestions }: any) => {
    const [inputValue, setInputValue] = React.useState('')
    const [suggestions, setSuggestions] = React.useState([])
    const [isLoading, setIsLoading] = React.useState(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
      if (e.target.value.trim()) {
        setIsLoading(true)
        // Simulate async suggestions
        setTimeout(async () => {
          if (getSuggestions) {
            try {
              const results = await getSuggestions(e.target.value)
              setSuggestions(results)
            } catch (error) {
              console.warn('Suggestion error:', error)
            }
          }
          setIsLoading(false)
        }, 100)
      } else {
        setSuggestions([])
      }
    }

    const addTag = (tag: string) => {
      if (tag.trim() && !tags.includes(tag.trim())) {
        onTagsChange([...tags, tag.trim()])
        setInputValue('')
        setSuggestions([])
      }
    }

    const removeTag = (index: number) => {
      const newTags = tags.filter((_: string, i: number) => i !== index)
      onTagsChange(newTags)
    }

    return (
      <div data-testid="tag-input">
        <input
          data-testid="tag-input-field"
          placeholder={placeholder}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue.trim()) {
              e.preventDefault()
              addTag(inputValue)
            }
          }}
        />
        {isLoading && <div data-testid="tag-loading">Loading...</div>}
        <div data-testid="current-tags">
          {tags.map((tag: string, index: number) => (
            <span key={index} data-testid={`tag-${tag}`}>
              {tag}
              <button
                data-testid={`remove-${tag}`}
                onClick={() => removeTag(index)}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {suggestions.length > 0 && (
          <div data-testid="tag-suggestions">
            {suggestions.map((suggestion: any, index: number) => (
              <div
                key={index}
                data-testid={`suggestion-${suggestion.tag}`}
                onClick={() => addTag(suggestion.tag)}
              >
                {suggestion.tag}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
  TagSuggestion: {}
}))

// Mock fetch for API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock other dependencies
jest.mock('@/lib/video-url-detector', () => ({
  detectVideoUrl: jest.fn(() => ({ isVideoUrl: false })),
  getPlatformDisplayName: jest.fn(() => 'Test Platform')
}))

jest.mock('@/components/recipes/VideoProgressTracker', () => ({
  VideoProgressTracker: () => <div data-testid="video-progress">Video Progress</div>
}))

describe('Tag Management Integration Tests', () => {
  const mockRecipes: any[] = []
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('Recipe Editing Flow', () => {
    it('loads existing tags when editing a recipe', async () => {
      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1", "ingredient 2"]',
        tags: '["existing-tag", "another-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Check that existing tags are displayed
      await waitFor(() => {
        expect(screen.getByTestId('tag-existing-tag')).toBeInTheDocument()
        expect(screen.getByTestId('tag-another-tag')).toBeInTheDocument()
      })
    })

    it('saves tag changes when editing a recipe', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: { id: 1, tags: '["new-tag"]' } })
      })

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["old-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Add a new tag
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'new-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: '["old-tag","new-tag"]' })
        })
      })
    })

    it('shows loading state while saving tags', async () => {
      // Mock a slow API response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ recipe: {} }) }), 200)
        )
      )

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["old-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Add a new tag
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'new-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Check for loading state
      await waitFor(() => {
        expect(screen.getByText('Saving tags...')).toBeInTheDocument()
      })
    })

    it('allows removing tags from existing recipe', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: { id: 1, tags: '[]' } })
      })

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["tag-to-remove"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Wait for tag to be displayed
      await waitFor(() => {
        expect(screen.getByTestId('tag-tag-to-remove')).toBeInTheDocument()
      })
      
      // Remove the tag
      const removeButton = screen.getByTestId('remove-tag-to-remove')
      fireEvent.click(removeButton)
      
      // Verify API call was made with empty tags
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: '[]' })
        })
      })
    })

    it('prevents duplicate tags when editing', async () => {
      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["existing-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Wait for existing tag to be displayed
      await waitFor(() => {
        expect(screen.getByTestId('tag-existing-tag')).toBeInTheDocument()
      })
      
      // Try to add the same tag again
      const tagInput = screen.getByTestId('tag-input-field')
      fireEvent.change(tagInput, { target: { value: 'existing-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Should still only have one instance
      const existingTags = screen.getAllByTestId('tag-existing-tag')
      expect(existingTags).toHaveLength(1)
    })
  })

  describe('Tag Suggestions', () => {
    it('fetches and displays tag suggestions in recipe editing', async () => {
      const mockSuggestions = [
        { tag: 'vegan', frequency: 10 },
        { tag: 'vegetarian', frequency: 8 }
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions })
      })

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["existing-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Type to trigger suggestions
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'veg' } })
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(screen.getByTestId('suggestion-vegan')).toBeInTheDocument()
        expect(screen.getByTestId('suggestion-vegetarian')).toBeInTheDocument()
      })
    })

    it('handles suggestion API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["existing-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Type to trigger suggestions
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'veg' } })
      
      // Should not crash, just not show suggestions
      await waitFor(() => {
        expect(screen.queryByTestId('tag-suggestions')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message when tag update fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Database connection failed' })
      })

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["old-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Add a new tag
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'new-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Check for error message
      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument()
      })
    })

    it('handles network errors during tag updates', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["old-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Add a new tag
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'new-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Check for network error message - the actual error message from the component
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Tag Input Component Behavior', () => {
    it('validates tag input and prevents empty tags', async () => {
      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '["existing-tag"]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Try to add empty tag
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: '   ' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Should not add empty tag
      await waitFor(() => {
        const existingTags = screen.getAllByTestId('tag-existing-tag')
        expect(existingTags).toHaveLength(1)
      })
    })

    it('handles tag input with special characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: { id: 1, tags: '["special-tag"]' } })
      })

      const recipeWithTags = {
        id: 1,
        title: 'Test Recipe',
        summary: 'Test summary',
        instructions: 'Test instructions',
        rawIngredients: '["ingredient 1"]',
        tags: '[]',
        startSeason: 1,
        endSeason: 12,
        grade: 3,
        time: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: []
      }

      render(<DataTable recipes={[recipeWithTags]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Click on recipe title to open sheet
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      // Add tag with special characters
      const tagInput = await waitFor(() => screen.getByTestId('tag-input-field'))
      fireEvent.change(tagInput, { target: { value: 'special-tag' } })
      fireEvent.keyDown(tagInput, { key: 'Enter' })
      
      // Should add the tag successfully
      await waitFor(() => {
        expect(screen.getByTestId('tag-special-tag')).toBeInTheDocument()
      })
    })
  })
}) 