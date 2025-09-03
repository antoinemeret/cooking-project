import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlannerPage from './page'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn()
  }
}))

describe('Planner Recipe Thumbnails', () => {
  const mockPlannedRecipe = {
    id: 1,
    recipeId: 1,
    completed: false,
    addedAt: new Date().toISOString(),
    recipe: {
      id: 1,
      title: 'Test Recipe',
      summary: 'A delicious test recipe',
      time: 30,
      grade: 3,
      tags: '["vegetarian"]'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    
    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/planner') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plannedRecipes: [mockPlannedRecipe],
            totalRecipes: 1,
            completedRecipes: 0
          })
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  describe('Thumbnail Display', () => {
    it('displays thumbnail image when recipe has image', async () => {
      const plannedRecipeWithImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/test-recipe-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute('src', '/test-recipe-image.jpg')
      expect(thumbnail).toHaveClass('w-16', 'h-16', 'object-cover', 'rounded-lg', 'border', 'border-border')
    })

    it('displays placeholder thumbnail when recipe has no image', async () => {
      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('displays placeholder thumbnail when recipe image is null', async () => {
      const plannedRecipeWithNullImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: null
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithNullImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('handles thumbnail load errors by falling back to placeholder', async () => {
      const plannedRecipeWithImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/broken-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      
      // Simulate image load error
      fireEvent.error(thumbnail)

      await waitFor(() => {
        expect(thumbnail).toHaveAttribute('src', '/placeholder-recipe.svg')
      })
    })

    it('prevents infinite error loops on placeholder failure', async () => {
      const plannedRecipeWithImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/broken-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      
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

    it('has proper accessibility attributes for thumbnails', async () => {
      const plannedRecipeWithImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/test-recipe-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('loading', 'lazy')
      expect(thumbnail).toHaveAttribute('alt', 'Test Recipe recipe image')
    })
  })

  describe('Completed Recipe Styling', () => {
    it('applies opacity styling to completed recipe thumbnails', async () => {
      const completedRecipe = {
        ...mockPlannedRecipe,
        completed: true,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/test-recipe-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [completedRecipe],
              totalRecipes: 1,
              completedRecipes: 1
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveClass('opacity-50')
    })

    it('does not apply opacity styling to non-completed recipe thumbnails', async () => {
      const activeRecipe = {
        ...mockPlannedRecipe,
        completed: false,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/test-recipe-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [activeRecipe],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).not.toHaveClass('opacity-50')
    })
  })

  describe('Layout and Positioning', () => {
    it('maintains proper layout with thumbnail, checkbox, and content', async () => {
      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      const checkbox = screen.getByRole('checkbox')
      const title = screen.getByText('Test Recipe')
      
      // Check that all elements are in the same card
      const card = thumbnail.closest('.border.rounded-lg')
      expect(card).toContainElement(checkbox)
      expect(card).toContainElement(thumbnail)
      expect(card).toContainElement(title)
    })

    it('positions thumbnail between checkbox and content', async () => {
      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      const thumbnailContainer = thumbnail.parentElement
      
      expect(thumbnailContainer).toHaveClass('flex-shrink-0')
      
      // Check that thumbnail is in a flex container with proper gap
      const flexContainer = thumbnailContainer?.parentElement
      expect(flexContainer).toHaveClass('flex', 'items-start', 'gap-4')
    })

    it('displays multiple planned recipes with thumbnails correctly', async () => {
      const multiplePlannedRecipes = [
        {
          ...mockPlannedRecipe,
          id: 1,
          recipe: { ...mockPlannedRecipe.recipe, id: 1, title: 'Recipe 1', image: '/image1.jpg' }
        },
        {
          ...mockPlannedRecipe,
          id: 2,
          recipe: { ...mockPlannedRecipe.recipe, id: 2, title: 'Recipe 2', image: '/image2.jpg' }
        },
        {
          ...mockPlannedRecipe,
          id: 3,
          recipe: { ...mockPlannedRecipe.recipe, id: 3, title: 'Recipe 3', image: null }
        }
      ]

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: multiplePlannedRecipes,
              totalRecipes: 3,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      // Check that all thumbnails are displayed
      const thumbnail1 = await screen.findByAltText('Recipe 1 recipe image')
      const thumbnail2 = await screen.findByAltText('Recipe 2 recipe image')
      const thumbnail3 = await screen.findByAltText('Recipe 3 recipe image')

      expect(thumbnail1).toHaveAttribute('src', '/image1.jpg')
      expect(thumbnail2).toHaveAttribute('src', '/image2.jpg')
      expect(thumbnail3).toHaveAttribute('src', '/placeholder-recipe.svg')
    })
  })

  describe('Performance', () => {
    it('applies lazy loading to thumbnails', async () => {
      const plannedRecipeWithImage = {
        ...mockPlannedRecipe,
        recipe: {
          ...mockPlannedRecipe.recipe,
          image: '/test-recipe-image.jpg'
        }
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/planner') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plannedRecipes: [plannedRecipeWithImage],
              totalRecipes: 1,
              completedRecipes: 0
            })
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      render(<PlannerPage />)

      const thumbnail = await screen.findByAltText('Test Recipe recipe image')
      expect(thumbnail).toHaveAttribute('loading', 'lazy')
    })
  })
}) 