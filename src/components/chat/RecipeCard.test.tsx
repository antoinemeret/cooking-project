import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecipeCard, RecipeSuggestion } from './RecipeCard'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}))

describe('RecipeCard', () => {
  const mockOnAccept = jest.fn()
  const mockOnDecline = jest.fn()

  const baseSuggestion: RecipeSuggestion = {
    recipe: {
      id: 1,
      title: 'Test Recipe',
      summary: 'A delicious test recipe',
      time: 30,
      grade: 3,
      tags: '["vegetarian", "quick"]'
    },
    reason: 'Perfect for your dietary preferences',
    confidence: 0.85
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Image Display', () => {
    it('displays recipe image when image URL is provided', () => {
      const suggestionWithImage: RecipeSuggestion = {
        ...baseSuggestion,
        recipe: {
          ...baseSuggestion.recipe,
          image: '/test-image.jpg'
        }
      }

      render(
        <RecipeCard
          suggestion={suggestionWithImage}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
        />
      )

      const image = screen.getByAltText('Test Recipe recipe image')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', '/test-image.jpg')
      expect(image).toHaveClass('w-16', 'h-16', 'object-cover', 'rounded-lg')
    })

    it('displays placeholder image when no image URL is provided', () => {
      render(
        <RecipeCard
          suggestion={baseSuggestion}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
        />
      )

      const image = screen.getByAltText('Test Recipe recipe image')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', '/placeholder-recipe.svg')
    })

    it('handles image load errors by falling back to placeholder', async () => {
      const suggestionWithImage: RecipeSuggestion = {
        ...baseSuggestion,
        recipe: {
          ...baseSuggestion.recipe,
          image: '/broken-image.jpg'
        }
      }

      render(
        <RecipeCard
          suggestion={suggestionWithImage}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
        />
      )

      const image = screen.getByAltText('Test Recipe recipe image')
      
      // Simulate image load error
      fireEvent.error(image)

      await waitFor(() => {
        expect(image).toHaveAttribute('src', '/placeholder-recipe.svg')
      })
    })
  })

  describe('Functionality', () => {
    it('calls onAccept when accept button is clicked', async () => {
      render(
        <RecipeCard
          suggestion={baseSuggestion}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
        />
      )

      const acceptButton = screen.getByText('Accept Recipe')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(mockOnAccept).toHaveBeenCalledWith(1)
      })
    })
  })
})