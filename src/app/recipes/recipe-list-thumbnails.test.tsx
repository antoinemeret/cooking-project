import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataTable } from './data-table'
import { Recipe } from './columns'

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Recipe List Thumbnails', () => {
  const mockOnRefresh = jest.fn()

  const baseRecipe: Recipe = {
    id: 1,
    title: 'Test Recipe',
    summary: 'A delicious test recipe',
    instructions: 'Mix ingredients and cook',
    rawIngredients: '["ingredient 1", "ingredient 2"]',
    tags: '["vegetarian"]',
    startSeason: 1,
    endSeason: 12,
    grade: 3,
    time: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: []
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('Thumbnail Display in Table', () => {
    it('displays thumbnail image when recipe has image', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute('src', '/test-recipe-image.jpg')
      expect(thumbnail).toHaveClass('w-12', 'h-12', 'object-cover', 'rounded-lg', 'border', 'border-border', 'flex-shrink-0')
    })

    it('displays placeholder thumbnail when recipe has no image', () => {
      render(<DataTable recipes={[baseRecipe]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('displays placeholder thumbnail when recipe image is null', () => {
      const recipeWithNullImage: Recipe = {
        ...baseRecipe,
        image: null
      }

      render(<DataTable recipes={[recipeWithNullImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('handles thumbnail load errors by falling back to placeholder', async () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/broken-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      
      // Simulate image load error
      fireEvent.error(thumbnail)

      await waitFor(() => {
        expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
      })
    })

    it('prevents infinite error loops on placeholder failure', async () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/broken-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      
      // Simulate first error (original image fails)
      fireEvent.error(thumbnail)
      
      await waitFor(() => {
        expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
      })

      // Simulate second error (placeholder fails) - should not cause infinite loop
      fireEvent.error(thumbnail)
      
      // Image should still have placeholder src and onerror should be null
      expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
      expect((thumbnail as HTMLImageElement).onerror).toBeNull()
    })

    it('has proper accessibility attributes for thumbnails', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('loading', 'lazy')
      expect(thumbnail).toHaveAttribute('alt', 'Test Recipe recipe image')
    })
  })

  describe('Table Layout with Thumbnails', () => {
    it('maintains proper layout with thumbnail and title', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      // Check that thumbnail and title are in the same container
      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      const titleLink = screen.getByText('Test Recipe')
      
      const container = thumbnail.closest('.flex')
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('flex', 'items-center', 'gap-3')
      expect(container).toContainElement(thumbnail)
      expect(container).toContainElement(titleLink)
    })

    it('displays multiple recipes with thumbnails correctly', () => {
      const recipes: Recipe[] = [
        { ...baseRecipe, id: 1, title: 'Recipe 1', image: '/image1.jpg' },
        { ...baseRecipe, id: 2, title: 'Recipe 2', image: '/image2.jpg' },
        { ...baseRecipe, id: 3, title: 'Recipe 3', image: null }
      ]

      render(<DataTable recipes={recipes} onRefresh={mockOnRefresh} loading={false} />)

      // Check that all thumbnails are displayed
      const thumbnail1 = screen.getByAltText('Recipe 1 recipe image')
      const thumbnail2 = screen.getByAltText('Recipe 2 recipe image')
      const thumbnail3 = screen.getByAltText('Recipe 3 recipe image')

      expect(thumbnail1).toHaveAttribute('src', '/image1.jpg')
      expect(thumbnail2).toHaveAttribute('src', '/image2.jpg')
      expect(thumbnail3).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('maintains clickable title links with thumbnails', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const titleLink = screen.getByText('Test Recipe')
      expect(titleLink).toBeInTheDocument()
      expect(titleLink.tagName).toBe('A')
      expect(titleLink).toHaveAttribute('href', '/recipes/1')
      expect(titleLink).toHaveClass('text-blue-600', 'hover:underline')
    })
  })

  describe('Performance and Loading', () => {
    it('applies lazy loading to thumbnails', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('loading', 'lazy')
    })

    it('handles loading state correctly', () => {
      render(<DataTable recipes={[baseRecipe]} onRefresh={mockOnRefresh} loading={true} />)

      // Should show loading indicator instead of recipes
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('uses appropriate thumbnail size for table view', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveClass('w-12', 'h-12')
    })

    it('maintains aspect ratio with object-cover', () => {
      const recipeWithImage: Recipe = {
        ...baseRecipe,
        image: '/test-recipe-image.jpg'
      }

      render(<DataTable recipes={[recipeWithImage]} onRefresh={mockOnRefresh} loading={false} />)

      const thumbnail = screen.getByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveClass('object-cover')
    })
  })
}) 