import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { 
  AssistantStoreType, 
  AssistantState, 
  TranscriptionResult, 
  Constraints, 
  GeneralConstraints, 
  PerMealConstraints, 
  SuggestionSections, 
  RecipeSuggestion, 
  SelectedRecipe 
} from './types'

const initialState = {
  // Current state
  currentState: 'idle' as AssistantState,
  
  // Voice recording
  isRecording: false,
  transcriptionResult: null,
  
  // Constraints
  constraints: null,
  
  // Current meal being suggested
  currentMealIndex: 0,
  
  // Suggestions for current meal
  currentSuggestions: null,
  
  // Selected recipes
  selectedRecipes: [],
  
  // UI state
  isLoading: false,
  error: null
}

export const useAssistantStore = create<AssistantStoreType>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // State transitions
      setState: (state: AssistantState) => {
        set({ currentState: state }, false, 'setState')
      },

      // Voice recording
      startRecording: () => {
        set({ 
          isRecording: true, 
          currentState: 'recording',
          error: null 
        }, false, 'startRecording')
      },

      stopRecording: () => {
        set({ 
          isRecording: false, 
          currentState: 'processing',
          isLoading: true 
        }, false, 'stopRecording')
      },

      setTranscriptionResult: (result: TranscriptionResult) => {
        set({ 
          transcriptionResult: result,
          currentState: 'interpreting',
          isLoading: true 
        }, false, 'setTranscriptionResult')
      },

      // Constraints
      setConstraints: (constraints: Constraints) => {
        set({ 
          constraints,
          currentState: 'editing',
          isLoading: false 
        }, false, 'setConstraints')
      },

      updateGeneralConstraints: (updates: Partial<GeneralConstraints>) => {
        const { constraints } = get()
        if (!constraints) return

        set({
          constraints: {
            ...constraints,
            general: {
              ...constraints.general,
              ...updates
            }
          }
        }, false, 'updateGeneralConstraints')
      },

      updatePerMealConstraints: (mealIndex: number, updates: Partial<PerMealConstraints>) => {
        const { constraints } = get()
        if (!constraints) return

        const updatedPerMeal = constraints.perMeal.map((meal, index) => 
          index === mealIndex 
            ? { ...meal, ...updates }
            : meal
        )

        set({
          constraints: {
            ...constraints,
            perMeal: updatedPerMeal
          }
        }, false, 'updatePerMealConstraints')
      },

      addPerMealConstraints: (newConstraints: PerMealConstraints) => {
        const { constraints } = get()
        if (!constraints) return

        set({
          constraints: {
            ...constraints,
            perMeal: [...constraints.perMeal, newConstraints]
          }
        }, false, 'addPerMealConstraints')
      },

      removePerMealConstraints: (mealIndex: number) => {
        const { constraints } = get()
        if (!constraints) return

        set({
          constraints: {
            ...constraints,
            perMeal: constraints.perMeal.filter((_, index) => index !== mealIndex)
          }
        }, false, 'removePerMealConstraints')
      },

      // Suggestions
      setCurrentMealIndex: (index: number) => {
        set({ 
          currentMealIndex: index,
          currentSuggestions: null,
          isLoading: true 
        }, false, 'setCurrentMealIndex')
      },

      setCurrentSuggestions: (suggestions: SuggestionSections) => {
        set({ 
          currentSuggestions: suggestions,
          currentState: 'suggesting',
          isLoading: false 
        }, false, 'setCurrentSuggestions')
      },

      // Selection
      selectRecipe: (mealIndex: number, recipe: RecipeSuggestion) => {
        const { selectedRecipes, constraints } = get()
        
        // Remove existing selection for this meal
        const filteredSelections = selectedRecipes.filter(sel => sel.mealIndex !== mealIndex)
        
        // Add new selection
        const newSelection: SelectedRecipe = { mealIndex, recipe }
        const updatedSelections = [...filteredSelections, newSelection]
        
        set({ selectedRecipes: updatedSelections }, false, 'selectRecipe')
        
        // Check if this was the last meal
        const mealCount = constraints?.general?.mealCount || 1
        if (mealIndex >= mealCount - 1) {
          set({ currentState: 'validating' }, false, 'selectRecipe->validating')
        } else {
          // Move to next meal
          set({ 
            currentMealIndex: mealIndex + 1,
            currentSuggestions: null,
            currentState: 'suggesting',
            isLoading: true 
          }, false, 'selectRecipe->nextMeal')
        }
      },

      removeSelectedRecipe: (mealIndex: number) => {
        const { selectedRecipes } = get()
        set({
          selectedRecipes: selectedRecipes.filter(sel => sel.mealIndex !== mealIndex)
        }, false, 'removeSelectedRecipe')
      },

      clearSelections: () => {
        set({ selectedRecipes: [] }, false, 'clearSelections')
      },

      // UI state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading }, false, 'setLoading')
      },

      setError: (error: string | null) => {
        set({ 
          error,
          isLoading: false,
          isRecording: false 
        }, false, 'setError')
      },

      // Reset
      reset: () => {
        set(initialState, false, 'reset')
      }
    }),
    {
      name: 'assistant-store',
      partialize: (state) => ({
        // Only persist essential state, not UI state
        constraints: state.constraints,
        selectedRecipes: state.selectedRecipes,
        currentMealIndex: state.currentMealIndex
      })
    }
  )
)

// Selectors for common use cases
export const useAssistantState = () => useAssistantStore(state => state.currentState)
export const useIsRecording = () => useAssistantStore(state => state.isRecording)
export const useIsLoading = () => useAssistantStore(state => state.isLoading)
export const useError = () => useAssistantStore(state => state.error)
export const useConstraints = () => useAssistantStore(state => state.constraints)
export const useCurrentMealIndex = () => useAssistantStore(state => state.currentMealIndex)
export const useCurrentSuggestions = () => useAssistantStore(state => state.currentSuggestions)
export const useSelectedRecipes = () => useAssistantStore(state => state.selectedRecipes)
export const useTranscriptionResult = () => useAssistantStore(state => state.transcriptionResult)
