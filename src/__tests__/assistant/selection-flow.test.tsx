import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAssistantStore } from '@/lib/assistant/state'
import type { RecipeSuggestion, Constraints } from '@/lib/assistant/types'

// Mock fetch
global.fetch = jest.fn()

describe('Assistant Selection Flow', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAssistantStore.getState().reset()
    jest.clearAllMocks()
  })

  describe('Selection Sequence', () => {
    it('should select recipe and advance to next meal', () => {
      const store = useAssistantStore.getState()
      
      // Set up initial state
      const constraints: Constraints = {
        general: {
          mealCount: 3,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      store.setState('suggesting')
      
      const mockRecipe: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      // Select recipe for meal 0
      store.selectRecipe(0, mockRecipe)
      
      const state = useAssistantStore.getState()
      expect(state.selectedRecipes).toHaveLength(1)
      expect(state.selectedRecipes[0].mealIndex).toBe(0)
      expect(state.selectedRecipes[0].recipe.id).toBe('1')
      expect(state.currentMealIndex).toBe(1)
      expect(state.currentState).toBe('suggesting')
    })

    it('should advance to validation when last meal is selected', () => {
      const store = useAssistantStore.getState()
      
      // Set up state with 2 meals
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      store.setState('suggesting')
      
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      // Select recipe for meal 0
      store.selectRecipe(0, mockRecipe1)
      expect(useAssistantStore.getState().currentState).toBe('suggesting')
      expect(useAssistantStore.getState().currentMealIndex).toBe(1)
      
      // Select recipe for meal 1 (last meal)
      store.selectRecipe(1, mockRecipe2)
      
      const state = useAssistantStore.getState()
      expect(state.selectedRecipes).toHaveLength(2)
      expect(state.currentState).toBe('validating')
    })

    it('should replace existing selection for the same meal', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      // Select recipe for meal 0
      store.selectRecipe(0, mockRecipe1)
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(1)
      
      // Select different recipe for meal 0 (should replace)
      store.selectRecipe(0, mockRecipe2)
      
      const state = useAssistantStore.getState()
      expect(state.selectedRecipes).toHaveLength(1)
      expect(state.selectedRecipes[0].recipe.id).toBe('2')
    })
  })

  describe('State Persistence', () => {
    it('should persist selections across state changes', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe',
        matchPercentage: 95
      }
      
      // Select recipe
      store.selectRecipe(0, mockRecipe)
      
      // Change state
      store.setState('editing')
      
      // Selections should persist
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(1)
      expect(useAssistantStore.getState().selectedRecipes[0].recipe.id).toBe('1')
    })

    it('should persist current meal index', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 3,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe',
        matchPercentage: 95
      }
      
      // Select recipe for meal 0
      store.selectRecipe(0, mockRecipe)
      
      // Current meal index should be 1
      expect(useAssistantStore.getState().currentMealIndex).toBe(1)
      
      // Change state
      store.setState('editing')
      
      // Current meal index should persist
      expect(useAssistantStore.getState().currentMealIndex).toBe(1)
    })
  })

  describe('Remove Selected Recipe', () => {
    it('should remove recipe from selections', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      // Add multiple selections
      store.selectRecipe(0, mockRecipe1)
      store.selectRecipe(1, mockRecipe2)
      
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(2)
      
      // Remove one selection
      store.removeSelectedRecipe(0)
      
      const state = useAssistantStore.getState()
      expect(state.selectedRecipes).toHaveLength(1)
      expect(state.selectedRecipes[0].mealIndex).toBe(1)
      expect(state.selectedRecipes[0].recipe.id).toBe('2')
    })

    it('should handle removing non-existent recipe gracefully', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 1,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe',
        matchPercentage: 95
      }
      
      // Add selection
      store.selectRecipe(0, mockRecipe)
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(1)
      
      // Try to remove non-existent meal
      store.removeSelectedRecipe(5)
      
      // Should still have 1 selection
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(1)
    })
  })

  describe('Clear Selections', () => {
    it('should clear all selections', () => {
      const store = useAssistantStore.getState()
      
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      // Add multiple selections
      store.selectRecipe(0, mockRecipe1)
      store.selectRecipe(1, mockRecipe2)
      
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(2)
      
      // Clear all selections
      store.clearSelections()
      
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(0)
    })
  })

  describe('Reset Function', () => {
    it('should reset all assistant state', () => {
      const store = useAssistantStore.getState()
      
      // Set up state
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      store.setState('suggesting')
      store.setCurrentMealIndex(1)
      
      const mockRecipe: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe',
        matchPercentage: 95
      }
      
      // Select recipe for the last meal (index 1) to trigger validation state
      store.selectRecipe(1, mockRecipe)
      
      // Verify state is set
      expect(useAssistantStore.getState().constraints).toBeTruthy()
      expect(useAssistantStore.getState().currentState).toBe('validating')
      expect(useAssistantStore.getState().currentMealIndex).toBe(1)
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(1)
      
      // Reset
      store.reset()
      
      // Verify state is reset
      expect(useAssistantStore.getState().constraints).toBeNull()
      expect(useAssistantStore.getState().currentState).toBe('idle')
      expect(useAssistantStore.getState().currentMealIndex).toBe(0)
      expect(useAssistantStore.getState().selectedRecipes).toHaveLength(0)
    })
  })

  describe('Final Write Integration', () => {
    beforeEach(() => {
      // Mock successful fetch responses
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, plannedRecipeId: 1 })
      })
    })

    it('should handle successful validation and write to planner', async () => {
      const user = userEvent.setup()
      
      const store = useAssistantStore.getState()
      
      // Set up constraints first
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      // Set up selections
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      store.selectRecipe(0, mockRecipe1)
      store.selectRecipe(1, mockRecipe2)
      
      const currentSelectedRecipes = useAssistantStore.getState().selectedRecipes
      
      // Mock validation component
      const ValidationStep = ({ selectedRecipes, onValidate }: any) => (
        <div data-testid="validation-step">
          <div data-testid="selected-count">{selectedRecipes.length}</div>
          <button data-testid="validate-button" onClick={onValidate}>
            Valider
          </button>
        </div>
      )
      
      const handleValidate = async () => {
        const userId = 'anonymous'
        
        for (const selection of currentSelectedRecipes) {
          await fetch('/api/planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipeId: parseInt(selection.recipe.id),
              userId: userId
            })
          })
        }
        
        store.reset()
      }
      
      render(
        <ValidationStep 
          selectedRecipes={currentSelectedRecipes} 
          onValidate={handleValidate}
        />
      )
      
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2')
      
      // Click validate button
      await user.click(screen.getByTestId('validate-button'))
      
      // Wait for fetch calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
      
      // Verify API calls
      expect(global.fetch).toHaveBeenCalledWith('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: 1,
          userId: 'anonymous'
        })
      })
      
      expect(global.fetch).toHaveBeenCalledWith('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: 2,
          userId: 'anonymous'
        })
      })
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock fetch to return error for one recipe
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to add recipe' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, plannedRecipeId: 2 })
        })
      
      const store = useAssistantStore.getState()
      
      // Set up constraints first
      const constraints: Constraints = {
        general: {
          mealCount: 2,
          seasonal: true
        },
        perMeal: []
      }
      
      store.setConstraints(constraints)
      
      const mockRecipe1: RecipeSuggestion = {
        id: '1',
        name: 'Test Recipe 1',
        matchPercentage: 95
      }
      
      const mockRecipe2: RecipeSuggestion = {
        id: '2',
        name: 'Test Recipe 2',
        matchPercentage: 90
      }
      
      store.selectRecipe(0, mockRecipe1)
      store.selectRecipe(1, mockRecipe2)
      
      const currentSelectedRecipes = useAssistantStore.getState().selectedRecipes
      
      const ValidationStep = ({ selectedRecipes, onValidate }: any) => (
        <div data-testid="validation-step">
          <button data-testid="validate-button" onClick={onValidate}>
            Valider
          </button>
        </div>
      )
      
      const handleValidate = async () => {
        const userId = 'anonymous'
        
        for (const selection of currentSelectedRecipes) {
          const response = await fetch('/api/planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipeId: parseInt(selection.recipe.id),
              userId: userId
            })
          })
          
          if (!response.ok) {
            console.error('Failed to add recipe to planner')
          }
        }
        
        store.reset()
      }
      
      render(
        <ValidationStep 
          selectedRecipes={currentSelectedRecipes} 
          onValidate={handleValidate}
        />
      )
      
      // Click validate button
      await user.click(screen.getByTestId('validate-button'))
      
      // Should still make both API calls despite one failing
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})
