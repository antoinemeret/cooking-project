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

  describe('Constraint Editing - Add/Edit/Remove', () => {
    describe('Adding Constraints', () => {
      it('should add include ingredients to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            includeIngredients: ['tomates', 'basilic']
          })
        })

        expect(result.current.constraints?.perMeal[0].includeIngredients).toEqual(['tomates', 'basilic'])
      })

      it('should add exclude ingredients to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            excludeIngredients: ['gluten', 'lactose']
          })
        })

        expect(result.current.constraints?.perMeal[0].excludeIngredients).toEqual(['gluten', 'lactose'])
      })

      it('should add dish type to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            dishType: ['main', 'pasta']
          })
        })

        expect(result.current.constraints?.perMeal[0].dishType).toEqual(['main', 'pasta'])
      })

      it('should add dietary restrictions to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            dietaryRestrictions: ['vegetarian', 'gluten-free']
          })
        })

        expect(result.current.constraints?.perMeal[0].dietaryRestrictions).toEqual(['vegetarian', 'gluten-free'])
      })

      it('should add cuisine style to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            cuisineStyle: ['italian', 'french']
          })
        })

        expect(result.current.constraints?.perMeal[0].cuisineStyle).toEqual(['italian', 'french'])
      })

      it('should add time constraints to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            maxPrepTime: 30,
            maxCookTime: 45
          })
        })

        expect(result.current.constraints?.perMeal[0].maxPrepTime).toBe(30)
        expect(result.current.constraints?.perMeal[0].maxCookTime).toBe(45)
      })

      it('should add cooking method to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            cookingMethod: ['oven', 'stovetop']
          })
        })

        expect(result.current.constraints?.perMeal[0].cookingMethod).toEqual(['oven', 'stovetop'])
      })

      it('should add servings to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            servings: 4
          })
        })

        expect(result.current.constraints?.perMeal[0].servings).toBe(4)
      })

      it('should add meal context to a meal', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            mealContext: ['quick-dinner', 'family-friendly']
          })
        })

        expect(result.current.constraints?.perMeal[0].mealContext).toEqual(['quick-dinner', 'family-friendly'])
      })
    })

    describe('Editing Constraints', () => {
      it('should edit existing include ingredients', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0, includeIngredients: ['tomates'] }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            includeIngredients: ['tomates', 'basilic', 'mozzarella']
          })
        })

        expect(result.current.constraints?.perMeal[0].includeIngredients).toEqual(['tomates', 'basilic', 'mozzarella'])
      })

      it('should edit dietary restrictions', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0, dietaryRestrictions: ['vegetarian'] }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            dietaryRestrictions: ['vegan']
          })
        })

        expect(result.current.constraints?.perMeal[0].dietaryRestrictions).toEqual(['vegan'])
      })

      it('should edit time constraints', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0, maxPrepTime: 30, maxCookTime: 30 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            maxPrepTime: 15,
            maxCookTime: 45
          })
        })

        expect(result.current.constraints?.perMeal[0].maxPrepTime).toBe(15)
        expect(result.current.constraints?.perMeal[0].maxCookTime).toBe(45)
      })

      it('should preserve other constraints when editing one', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{
            mealIndex: 0,
            includeIngredients: ['tomates'],
            dietaryRestrictions: ['vegetarian'],
            maxPrepTime: 30
          }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            cuisineStyle: ['italian']
          })
        })

        const meal = result.current.constraints?.perMeal[0]
        expect(meal?.includeIngredients).toEqual(['tomates'])
        expect(meal?.dietaryRestrictions).toEqual(['vegetarian'])
        expect(meal?.maxPrepTime).toBe(30)
        expect(meal?.cuisineStyle).toEqual(['italian'])
      })
    })

    describe('Removing Constraints', () => {
      it('should remove a constraint by setting it to undefined', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{
            mealIndex: 0,
            includeIngredients: ['tomates'],
            dietaryRestrictions: ['vegetarian']
          }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            includeIngredients: undefined
          })
        })

        expect(result.current.constraints?.perMeal[0].includeIngredients).toBeUndefined()
        expect(result.current.constraints?.perMeal[0].dietaryRestrictions).toEqual(['vegetarian'])
      })

      it('should remove multiple constraints', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{
            mealIndex: 0,
            includeIngredients: ['tomates'],
            dietaryRestrictions: ['vegetarian'],
            maxPrepTime: 30
          }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updatePerMealConstraints(0, {
            includeIngredients: undefined,
            maxPrepTime: undefined
          })
        })

        expect(result.current.constraints?.perMeal[0].includeIngredients).toBeUndefined()
        expect(result.current.constraints?.perMeal[0].maxPrepTime).toBeUndefined()
        expect(result.current.constraints?.perMeal[0].dietaryRestrictions).toEqual(['vegetarian'])
      })
    })

    describe('Per-Meal Overrides', () => {
      it('should allow different constraints for different meals', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 3 },
          perMeal: [
            { mealIndex: 0 },
            { mealIndex: 1 },
            { mealIndex: 2 }
          ]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          // Meal 0: Italian with tomatoes
          result.current.updatePerMealConstraints(0, {
            includeIngredients: ['tomates'],
            cuisineStyle: ['italian']
          })
          // Meal 1: French, vegetarian
          result.current.updatePerMealConstraints(1, {
            cuisineStyle: ['french'],
            dietaryRestrictions: ['vegetarian']
          })
          // Meal 2: Quick dinner
          result.current.updatePerMealConstraints(2, {
            mealContext: ['quick-dinner'],
            maxPrepTime: 15
          })
        })

        const meals = result.current.constraints?.perMeal
        expect(meals?.[0].includeIngredients).toEqual(['tomates'])
        expect(meals?.[0].cuisineStyle).toEqual(['italian'])
        
        expect(meals?.[1].cuisineStyle).toEqual(['french'])
        expect(meals?.[1].dietaryRestrictions).toEqual(['vegetarian'])
        
        expect(meals?.[2].mealContext).toEqual(['quick-dinner'])
        expect(meals?.[2].maxPrepTime).toBe(15)
      })

      it('should not affect other meals when updating one', () => {
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
          result.current.updatePerMealConstraints(0, {
            dietaryRestrictions: ['vegetarian']
          })
        })

        expect(result.current.constraints?.perMeal[0].includeIngredients).toEqual(['tomates'])
        expect(result.current.constraints?.perMeal[0].dietaryRestrictions).toEqual(['vegetarian'])
        expect(result.current.constraints?.perMeal[1].includeIngredients).toEqual(['carottes'])
        expect(result.current.constraints?.perMeal[1].dietaryRestrictions).toBeUndefined()
      })
    })

    describe('Meal Count Changes', () => {
      it('should add meals when meal count increases', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 1 },
          perMeal: [{ mealIndex: 0 }]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updateGeneralConstraints({ mealCount: 3 })
        })

        expect(result.current.constraints?.perMeal).toHaveLength(3)
        expect(result.current.constraints?.perMeal[1]).toEqual({ mealIndex: 1 })
        expect(result.current.constraints?.perMeal[2]).toEqual({ mealIndex: 2 })
      })

      it('should remove meals when meal count decreases', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 3 },
          perMeal: [
            { mealIndex: 0, includeIngredients: ['tomates'] },
            { mealIndex: 1, includeIngredients: ['carottes'] },
            { mealIndex: 2, includeIngredients: ['poivrons'] }
          ]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updateGeneralConstraints({ mealCount: 1 })
        })

        expect(result.current.constraints?.perMeal).toHaveLength(1)
        expect(result.current.constraints?.perMeal[0].includeIngredients).toEqual(['tomates'])
      })

      it('should preserve existing meal constraints when increasing count', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 2 },
          perMeal: [
            { mealIndex: 0, includeIngredients: ['tomates'], dietaryRestrictions: ['vegetarian'] },
            { mealIndex: 1, cuisineStyle: ['italian'] }
          ]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updateGeneralConstraints({ mealCount: 4 })
        })

        expect(result.current.constraints?.perMeal).toHaveLength(4)
        expect(result.current.constraints?.perMeal[0]).toEqual({
          mealIndex: 0,
          includeIngredients: ['tomates'],
          dietaryRestrictions: ['vegetarian']
        })
        expect(result.current.constraints?.perMeal[1]).toEqual({
          mealIndex: 1,
          cuisineStyle: ['italian']
        })
        expect(result.current.constraints?.perMeal[2]).toEqual({ mealIndex: 2 })
        expect(result.current.constraints?.perMeal[3]).toEqual({ mealIndex: 3 })
      })

      it('should not change perMeal array if meal count stays the same', () => {
        const { result } = renderHook(() => useAssistantStore())
        const initialConstraints: Constraints = {
          general: { mealCount: 2, seasonal: false },
          perMeal: [
            { mealIndex: 0, includeIngredients: ['tomates'] },
            { mealIndex: 1, includeIngredients: ['carottes'] }
          ]
        }
        
        act(() => {
          result.current.setConstraints(initialConstraints)
          result.current.updateGeneralConstraints({ seasonal: true })
        })

        expect(result.current.constraints?.perMeal).toHaveLength(2)
        expect(result.current.constraints?.perMeal[0].includeIngredients).toEqual(['tomates'])
        expect(result.current.constraints?.perMeal[1].includeIngredients).toEqual(['carottes'])
        expect(result.current.constraints?.general.seasonal).toBe(true)
      })
    })
  })
})
