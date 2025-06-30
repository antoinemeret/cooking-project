'use client'

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'

interface MealPlan {
  id: number
  status: string
  plannedRecipes: Array<{
    id: number
    recipeId: number
    completed: boolean
    addedAt: string
    recipe: {
      id: number
      title: string
      summary?: string
      time?: number
      grade?: number
    }
  }>
}

interface AppState {
  mealPlan: MealPlan | null
  groceryList: any[] // Will be populated from grocery API
  isOnline: boolean
  lastSync: Date | null
  pendingChanges: Array<{
    type: 'recipe_completion' | 'grocery_check' | 'recipe_removal'
    data: any
    timestamp: Date
  }>
}

type AppAction = 
  | { type: 'SET_MEAL_PLAN'; payload: MealPlan | null }
  | { type: 'SET_GROCERY_LIST'; payload: any[] }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'UPDATE_RECIPE_COMPLETION'; payload: { recipeId: number; completed: boolean } }
  | { type: 'UPDATE_GROCERY_ITEM'; payload: { name: string; checked: boolean } }
  | { type: 'REMOVE_RECIPE'; payload: { recipeId: number } }
  | { type: 'ADD_PENDING_CHANGE'; payload: { type: string; data: any } }
  | { type: 'CLEAR_PENDING_CHANGES' }
  | { type: 'SET_LAST_SYNC'; payload: Date }

const initialState: AppState = {
  mealPlan: null,
  groceryList: [],
  isOnline: true,
  lastSync: null,
  pendingChanges: []
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MEAL_PLAN':
      return { ...state, mealPlan: action.payload }
    
    case 'SET_GROCERY_LIST':
      return { ...state, groceryList: action.payload }
    
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload }
    
    case 'UPDATE_RECIPE_COMPLETION':
      if (!state.mealPlan) return state
      return {
        ...state,
        mealPlan: {
          ...state.mealPlan,
          plannedRecipes: state.mealPlan.plannedRecipes.map(pr =>
            pr.recipeId === action.payload.recipeId
              ? { ...pr, completed: action.payload.completed }
              : pr
          )
        }
      }
    
    case 'UPDATE_GROCERY_ITEM':
      return {
        ...state,
        groceryList: state.groceryList.map(item =>
          item.name === action.payload.name
            ? { ...item, checked: action.payload.checked }
            : item
        )
      }
    
    case 'REMOVE_RECIPE':
      if (!state.mealPlan) return state
      return {
        ...state,
        mealPlan: {
          ...state.mealPlan,
          plannedRecipes: state.mealPlan.plannedRecipes.filter(pr =>
            pr.recipeId !== action.payload.recipeId
          )
        }
      }
    
    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: [
          ...state.pendingChanges,
          {
            type: action.payload.type as any,
            data: action.payload.data,
            timestamp: new Date()
          }
        ]
      }
    
    case 'CLEAR_PENDING_CHANGES':
      return { ...state, pendingChanges: [] }
    
    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload }
    
    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<AppAction>
  syncData: () => Promise<void>
  updateRecipeCompletion: (recipeId: number, completed: boolean) => Promise<void>
  updateGroceryItem: (name: string, checked: boolean) => Promise<void>
  removeRecipe: (recipeId: number) => Promise<void>
} | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true })
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial online status
    dispatch({ type: 'SET_ONLINE_STATUS', payload: navigator.onLine })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync pending changes when coming back online
  useEffect(() => {
    if (state.isOnline && state.pendingChanges.length > 0) {
      syncPendingChanges()
    }
  }, [state.isOnline])

  const syncData = async () => {
    if (!state.isOnline) return

    try {
      // Fetch latest meal plan
      const mealPlanResponse = await fetch('/api/planner?userId=user123')
      if (mealPlanResponse.ok) {
        const mealPlanData = await mealPlanResponse.json()
        dispatch({ type: 'SET_MEAL_PLAN', payload: mealPlanData.mealPlan })
      }

      // Fetch latest grocery list
      const groceryResponse = await fetch('/api/groceries?userId=user123')
      if (groceryResponse.ok) {
        const groceryData = await groceryResponse.json()
        dispatch({ type: 'SET_GROCERY_LIST', payload: groceryData.groceryList || [] })
      }

      dispatch({ type: 'SET_LAST_SYNC', payload: new Date() })
    } catch (error) {
      console.error('Failed to sync data:', error)
    }
  }

  const syncPendingChanges = async () => {
    if (!state.isOnline || state.pendingChanges.length === 0) return

    try {
      for (const change of state.pendingChanges) {
        switch (change.type) {
          case 'recipe_completion':
            await fetch('/api/planner', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: 'user123',
                recipeId: change.data.recipeId,
                completed: change.data.completed
              })
            })
            break
          
          case 'grocery_check':
            await fetch('/api/groceries', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: 'user123',
                ingredientName: change.data.name,
                checked: change.data.checked
              })
            })
            break
          
          case 'recipe_removal':
            await fetch('/api/planner', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: 'user123',
                recipeId: change.data.recipeId
              })
            })
            break
        }
      }

      dispatch({ type: 'CLEAR_PENDING_CHANGES' })
      await syncData() // Refresh data after syncing changes
    } catch (error) {
      console.error('Failed to sync pending changes:', error)
    }
  }

  const updateRecipeCompletion = async (recipeId: number, completed: boolean) => {
    // Optimistic update
    dispatch({ type: 'UPDATE_RECIPE_COMPLETION', payload: { recipeId, completed } })

    if (state.isOnline) {
      try {
        const response = await fetch('/api/planner', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user123',
            recipeId,
            completed
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update recipe completion')
        }

        // Refresh grocery list as it might have changed
        const groceryResponse = await fetch('/api/groceries?userId=user123')
        if (groceryResponse.ok) {
          const groceryData = await groceryResponse.json()
          dispatch({ type: 'SET_GROCERY_LIST', payload: groceryData.groceryList || [] })
        }
      } catch (error) {
        // Rollback optimistic update
        dispatch({ type: 'UPDATE_RECIPE_COMPLETION', payload: { recipeId, completed: !completed } })
        
        // Add to pending changes for later sync
        dispatch({ 
          type: 'ADD_PENDING_CHANGE', 
          payload: { type: 'recipe_completion', data: { recipeId, completed } }
        })
        
        console.error('Failed to update recipe completion:', error)
      }
    } else {
      // Add to pending changes
      dispatch({ 
        type: 'ADD_PENDING_CHANGE', 
        payload: { type: 'recipe_completion', data: { recipeId, completed } }
      })
    }
  }

  const updateGroceryItem = async (name: string, checked: boolean) => {
    // Optimistic update
    dispatch({ type: 'UPDATE_GROCERY_ITEM', payload: { name, checked } })

    if (state.isOnline) {
      try {
        const response = await fetch('/api/groceries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user123',
            ingredientName: name,
            checked
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update grocery item')
        }
      } catch (error) {
        // Rollback optimistic update
        dispatch({ type: 'UPDATE_GROCERY_ITEM', payload: { name, checked: !checked } })
        
        // Add to pending changes
        dispatch({ 
          type: 'ADD_PENDING_CHANGE', 
          payload: { type: 'grocery_check', data: { name, checked } }
        })
        
        console.error('Failed to update grocery item:', error)
      }
    } else {
      // Add to pending changes
      dispatch({ 
        type: 'ADD_PENDING_CHANGE', 
        payload: { type: 'grocery_check', data: { name, checked } }
      })
    }
  }

  const removeRecipe = async (recipeId: number) => {
    // Optimistic update
    dispatch({ type: 'REMOVE_RECIPE', payload: { recipeId } })

    if (state.isOnline) {
      try {
        const response = await fetch('/api/planner', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user123',
            recipeId
          })
        })

        if (!response.ok) {
          throw new Error('Failed to remove recipe')
        }

        // Refresh grocery list as it might have changed
        const groceryResponse = await fetch('/api/groceries?userId=user123')
        if (groceryResponse.ok) {
          const groceryData = await groceryResponse.json()
          dispatch({ type: 'SET_GROCERY_LIST', payload: groceryData.groceryList || [] })
        }
      } catch (error) {
        // For removal, we'd need to re-add the recipe, but that's complex
        // Instead, just refresh the data
        await syncData()
        
        // Add to pending changes
        dispatch({ 
          type: 'ADD_PENDING_CHANGE', 
          payload: { type: 'recipe_removal', data: { recipeId } }
        })
        
        console.error('Failed to remove recipe:', error)
      }
    } else {
      // Add to pending changes
      dispatch({ 
        type: 'ADD_PENDING_CHANGE', 
        payload: { type: 'recipe_removal', data: { recipeId } }
      })
    }
  }

  // Initial data sync
  useEffect(() => {
    syncData()
  }, [])

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      syncData,
      updateRecipeCompletion,
      updateGroceryItem,
      removeRecipe
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
} 