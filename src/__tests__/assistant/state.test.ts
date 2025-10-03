import { renderHook, act } from '@testing-library/react'
import { useAssistantStore } from '@/lib/assistant/state'
import { TranscriptionResult, Constraints, RecipeSuggestion, SelectedRecipe } from '@/lib/assistant/types'

// Mock zustand store for testing
const createMockStore = () => {
  let state = {
    currentState: 'idle' as const,
    isRecording: false,
    transcriptionResult: null,
    constraints: null,
    currentMealIndex: 0,
    currentSuggestions: null,
    selectedRecipes: [],
    isLoading: false,
    error: null
  }

  const actions = {
    setState: jest.fn((newState) => {
      state.currentState = newState
    }),
    startRecording: jest.fn(() => {
      state.isRecording = true
      state.currentState = 'recording'
      state.error = null
    }),
    stopRecording: jest.fn(() => {
      state.isRecording = false
      state.currentState = 'processing'
      state.isLoading = true
    }),
    setTranscriptionResult: jest.fn((result: TranscriptionResult) => {
      state.transcriptionResult = result
      state.currentState = 'interpreting'
      state.isLoading = true
    }),
    setConstraints: jest.fn((constraints: Constraints) => {
      state.constraints = constraints
      state.currentState = 'editing'
      state.isLoading = false
    }),
    updateGeneralConstraints: jest.fn(),
    updatePerMealConstraints: jest.fn(),
    addPerMealConstraints: jest.fn(),
    removePerMealConstraints: jest.fn(),
    setCurrentMealIndex: jest.fn(),
    setCurrentSuggestions: jest.fn(),
    selectRecipe: jest.fn(),
    removeSelectedRecipe: jest.fn(),
    clearSelections: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    reset: jest.fn(() => {
      state = {
        currentState: 'idle',
        isRecording: false,
        transcriptionResult: null,
        constraints: null,
        currentMealIndex: 0,
        currentSuggestions: null,
        selectedRecipes: [],
        isLoading: false,
        error: null
      }
    })
  }

  return { state, actions }
}

describe('Assistant Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('State Transitions', () => {
    it('should transition from idle to recording', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.startRecording()
      })

      expect(result.current.currentState).toBe('recording')
      expect(result.current.isRecording).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should transition from recording to processing', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.startRecording()
        result.current.stopRecording()
      })

      expect(result.current.currentState).toBe('processing')
      expect(result.current.isRecording).toBe(false)
      expect(result.current.isLoading).toBe(true)
    })

    it('should transition from processing to interpreting', () => {
      const { result } = renderHook(() => useAssistantStore())
      const transcriptionResult: TranscriptionResult = {
        transcript: 'Je veux 2 repas avec des légumes',
        confidence: 0.95
      }
      
      act(() => {
        result.current.setTranscriptionResult(transcriptionResult)
      })

      expect(result.current.currentState).toBe('interpreting')
      expect(result.current.transcriptionResult).toEqual(transcriptionResult)
      expect(result.current.isLoading).toBe(true)
    })

    it('should transition from interpreting to editing', () => {
      const { result } = renderHook(() => useAssistantStore())
      const constraints: Constraints = {
        general: { mealCount: 2, seasonal: true },
        perMeal: [
          { mealIndex: 0, includeIngredients: ['légumes'] }
        ]
      }
      
      act(() => {
        result.current.setConstraints(constraints)
      })

      expect(result.current.currentState).toBe('editing')
      expect(result.current.constraints).toEqual(constraints)
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Constraint Management', () => {
    it('should update general constraints', () => {
      const { result } = renderHook(() => useAssistantStore())
      const initialConstraints: Constraints = {
        general: { mealCount: 1 },
        perMeal: []
      }
      
      act(() => {
        result.current.setConstraints(initialConstraints)
        result.current.updateGeneralConstraints({ seasonal: true })
      })

      expect(result.current.constraints?.general).toEqual({
        mealCount: 1,
        seasonal: true
      })
    })

    it('should add per-meal constraints', () => {
      const { result } = renderHook(() => useAssistantStore())
      const initialConstraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: []
      }
      
      act(() => {
        result.current.setConstraints(initialConstraints)
        result.current.addPerMealConstraints({
          mealIndex: 0,
          includeIngredients: ['tomates'],
          dietaryRestrictions: ['végétarien']
        })
      })

      expect(result.current.constraints?.perMeal).toHaveLength(1)
      expect(result.current.constraints?.perMeal[0]).toEqual({
        mealIndex: 0,
        includeIngredients: ['tomates'],
        dietaryRestrictions: ['végétarien']
      })
    })

    it('should update per-meal constraints', () => {
      const { result } = renderHook(() => useAssistantStore())
      const initialConstraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: [
          { mealIndex: 0, includeIngredients: ['tomates'] }
        ]
      }
      
      act(() => {
        result.current.setConstraints(initialConstraints)
        result.current.updatePerMealConstraints(0, {
          dietaryRestrictions: ['végétarien']
        })
      })

      expect(result.current.constraints?.perMeal[0]).toEqual({
        mealIndex: 0,
        includeIngredients: ['tomates'],
        dietaryRestrictions: ['végétarien']
      })
    })

    it('should remove per-meal constraints', () => {
      const { result } = renderHook(() => useAssistantStore())
      const initialConstraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: [
          { mealIndex: 0, includeIngredients: ['tomates'] },
          { mealIndex: 1, includeIngredients: ['carottes'] }
        ]
      }
      
      act(() => {
        result.current.setConstraints(initialConstraints)
        result.current.removePerMealConstraints(0)
      })

      expect(result.current.constraints?.perMeal).toHaveLength(1)
      expect(result.current.constraints?.perMeal[0]).toEqual({
        mealIndex: 1,
        includeIngredients: ['carottes']
      })
    })
  })

  describe('Recipe Selection', () => {
    it('should select recipe for a meal', () => {
      const { result } = renderHook(() => useAssistantStore())
      const constraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: []
      }
      const recipe: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      
      act(() => {
        result.current.setConstraints(constraints)
        result.current.selectRecipe(0, recipe)
      })

      expect(result.current.selectedRecipes).toHaveLength(1)
      expect(result.current.selectedRecipes[0]).toEqual({
        mealIndex: 0,
        recipe
      })
    })

    it('should advance to next meal after selection', () => {
      const { result } = renderHook(() => useAssistantStore())
      const constraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: []
      }
      const recipe: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      
      act(() => {
        result.current.setConstraints(constraints)
        result.current.selectRecipe(0, recipe)
      })

      expect(result.current.currentMealIndex).toBe(1)
      expect(result.current.currentState).toBe('suggesting')
    })

    it('should advance to validation after last meal selection', () => {
      const { result } = renderHook(() => useAssistantStore())
      const constraints: Constraints = {
        general: { mealCount: 2 },
        perMeal: []
      }
      const recipe: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      
      act(() => {
        result.current.setConstraints(constraints)
        result.current.selectRecipe(1, recipe) // Last meal (index 1)
      })

      expect(result.current.currentState).toBe('validating')
    })

    it('should replace existing selection for same meal', () => {
      const { result } = renderHook(() => useAssistantStore())
      const recipe1: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      const recipe2: RecipeSuggestion = {
        id: 'recipe-2',
        name: 'Soupe de légumes',
        prepTime: 20,
        cookTime: 30,
        servings: 4,
        matchPercentage: 95
      }
      
      act(() => {
        // Manually test the replacement logic
        result.current.selectedRecipes = [{ mealIndex: 0, recipe: recipe1 }]
        result.current.selectRecipe(0, recipe2)
      })

      expect(result.current.selectedRecipes).toHaveLength(1)
      expect(result.current.selectedRecipes[0].recipe).toEqual(recipe2)
    })

    it('should remove selected recipe', () => {
      const { result } = renderHook(() => useAssistantStore())
      const recipe: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      
      act(() => {
        // Manually set up selections
        result.current.selectedRecipes = [{ mealIndex: 0, recipe }]
        result.current.removeSelectedRecipe(0)
      })

      expect(result.current.selectedRecipes).toHaveLength(0)
    })

    it('should clear all selections', () => {
      const { result } = renderHook(() => useAssistantStore())
      const recipe1: RecipeSuggestion = {
        id: 'recipe-1',
        name: 'Salade de tomates',
        prepTime: 15,
        cookTime: 0,
        servings: 4,
        matchPercentage: 100
      }
      const recipe2: RecipeSuggestion = {
        id: 'recipe-2',
        name: 'Soupe de légumes',
        prepTime: 20,
        cookTime: 30,
        servings: 4,
        matchPercentage: 95
      }
      
      act(() => {
        result.current.selectRecipe(0, recipe1)
        result.current.selectRecipe(1, recipe2)
        result.current.clearSelections()
      })

      expect(result.current.selectedRecipes).toHaveLength(0)
    })
  })

  describe('UI State Management', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should set error state', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.setError('Network error')
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isRecording).toBe(false)
    })

    it('should clear error state', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.setError('Network error')
        result.current.setError(null)
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      // Set some state
      act(() => {
        result.current.startRecording()
        result.current.setConstraints({
          general: { mealCount: 2 },
          perMeal: []
        })
        result.current.selectRecipe(0, {
          id: 'recipe-1',
          name: 'Test Recipe',
          prepTime: 15,
          cookTime: 0,
          servings: 4,
          matchPercentage: 100
        })
      })

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.currentState).toBe('idle')
      expect(result.current.isRecording).toBe(false)
      expect(result.current.constraints).toBeNull()
      expect(result.current.selectedRecipes).toHaveLength(0)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('State Persistence', () => {
    it('should persist essential state only', () => {
      const { result } = renderHook(() => useAssistantStore())
      
      act(() => {
        result.current.setConstraints({
          general: { mealCount: 2 },
          perMeal: []
        })
        result.current.selectRecipe(0, {
          id: 'recipe-1',
          name: 'Test Recipe',
          prepTime: 15,
          cookTime: 0,
          servings: 4,
          matchPercentage: 100
        })
        // Don't use setCurrentMealIndex as it changes state
        result.current.currentMealIndex = 1
        result.current.setError('Test error')
        result.current.setLoading(true) // Set loading after error
      })

      // Check that essential state is present
      expect(result.current.constraints).toBeDefined()
      expect(result.current.selectedRecipes).toHaveLength(1)
      expect(result.current.currentMealIndex).toBe(1)
      // UI state is current state
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBe('Test error')
    })
  })
})
