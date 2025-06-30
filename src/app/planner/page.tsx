"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RefreshCw, Trash2, Clock, Star, Calendar, CheckCircle2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { analytics } from '@/lib/analytics'

// Temporary interface for planned recipes until we have the API
interface PlannedRecipe {
  id: number
  recipeId: number
  completed: boolean
  addedAt: string
  recipe: {
    id: number
    title: string
    summary: string
    time: number
    grade: number
    tags?: string
  }
}

interface MealPlan {
  id: number
  plannedRecipes: PlannedRecipe[]
  totalRecipes: number
  completedRecipes: number
}

interface PlannedRecipeCardProps {
  plannedRecipe: PlannedRecipe
  onToggleComplete: (completed: boolean) => void
  onRemove: () => void
  onViewRecipe: () => void
}

function PlannedRecipeCard({ 
  plannedRecipe, 
  onToggleComplete, 
  onRemove, 
  onViewRecipe 
}: PlannedRecipeCardProps) {
  const { recipe, completed, addedAt } = plannedRecipe
  
  // Parse tags safely
  let tags: string[] = []
  try {
    tags = recipe.tags ? JSON.parse(recipe.tags) : []
  } catch {
    tags = []
  }

  const date = new Date(addedAt)
  const isToday = date.toDateString() === new Date().toDateString()
  const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString()
  
  let displayDate: string
  if (isToday) {
    displayDate = 'Today'
  } else if (isYesterday) {
    displayDate = 'Yesterday'
  } else {
    displayDate = date.toLocaleDateString()
  }

  const renderStars = (grade: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-4 w-4",
          i < grade ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ))
  }

  return (
    <div className={cn(
      "border rounded-lg p-4 sm:p-6 bg-card text-card-foreground shadow-sm transition-all",
      completed && "bg-muted/30"
    )}>
      <div className="flex items-start gap-4">
        {/* Completion Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <Checkbox
            checked={completed}
            onCheckedChange={onToggleComplete}
            aria-label={`Mark ${recipe.title} as ${completed ? 'incomplete' : 'complete'}`}
            className="h-5 w-5"
          />
        </div>

        {/* Recipe Content */}
        <div className="flex-1 min-w-0">
          {/* Recipe Header */}
          <div className="flex items-start justify-between mb-2">
            <button
              onClick={onViewRecipe}
              className={cn(
                "text-left font-semibold text-lg hover:underline transition-colors",
                completed 
                  ? "text-muted-foreground line-through" 
                  : "text-foreground hover:text-primary"
              )}
            >
              {recipe.title}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={onRemove}
              aria-label={`Remove ${recipe.title} from meal plan`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Recipe Summary */}
          {recipe.summary && (
            <p className={cn(
              "text-sm text-muted-foreground mb-3 line-clamp-2",
              completed && "line-through"
            )}>
              {recipe.summary}
            </p>
          )}

          {/* Recipe Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{recipe.time} min</span>
              </div>
              <div className="flex items-center gap-1">
                {renderStars(recipe.grade)}
              </div>
              <div className="flex items-center gap-1">
                <span>🍽️ 4</span>
              </div>
              <span>Added {displayDate}</span>
            </div>
            
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className={cn(
                      "inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground",
                      completed && "opacity-50"
                    )}
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlannerPage() {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recipeToRemove, setRecipeToRemove] = useState<PlannedRecipe | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<PlannedRecipe['recipe'] | null>(null)
  const [fullRecipeDetails, setFullRecipeDetails] = useState<any>(null)
  const [loadingRecipeDetails, setLoadingRecipeDetails] = useState(false)
  const userId = 'user123' // TODO: Replace with actual user ID

  // Temporary mock data for development
  const mockMealPlan: MealPlan = {
    id: 1,
    totalRecipes: 3,
    completedRecipes: 1,
    plannedRecipes: [
      {
        id: 1,
        recipeId: 1,
        completed: true,
        addedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        recipe: {
          id: 1,
          title: "Spaghetti Carbonara",
          summary: "Classic Italian pasta dish with eggs, cheese, and pancetta",
          time: 25,
          grade: 3,
          tags: '["Italian", "Pasta", "Quick"]'
        }
      },
      {
        id: 2,
        recipeId: 2,
        completed: false,
        addedAt: new Date().toISOString(), // Today
        recipe: {
          id: 2,
          title: "Caesar Salad",
          summary: "Fresh romaine lettuce with homemade Caesar dressing and croutons",
          time: 15,
          grade: 2,
          tags: '["Salad", "Vegetarian", "Light"]'
        }
      },
      {
        id: 3,
        recipeId: 3,
        completed: false,
        addedAt: new Date().toISOString(), // Today
        recipe: {
          id: 3,
          title: "Grilled Chicken Breast",
          summary: "Juicy grilled chicken breast with herbs and spices",
          time: 30,
          grade: 3,
          tags: '["Protein", "Healthy", "Grilled"]'
        }
      }
    ]
  }

  const fetchMealPlan = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching meal plan for user:', userId)
      const response = await fetch(`/api/planner?userId=${userId}`)
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch meal plan`)
      }
      
      const data = await response.json()
      console.log('Meal plan data:', data)
      // Create the expected structure with totalRecipes and completedRecipes
      const mealPlanWithCounts = {
        ...data.mealPlan,
        totalRecipes: data.totalRecipes,
        completedRecipes: data.completedRecipes
      }
      setMealPlan(mealPlanWithCounts)
    } catch (err) {
      console.error('Error fetching meal plan:', err)
      setError('Failed to load meal plan')
      // Fallback to mock data for development
      console.log('Using mock data as fallback')
      setMealPlan(mockMealPlan)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const fetchFullRecipeDetails = async (recipeId: number) => {
    setLoadingRecipeDetails(true)
    try {
      const response = await fetch(`/api/recipes/list`)
      if (response.ok) {
        const data = await response.json()
        const fullRecipe = data.recipes.find((r: any) => r.id === recipeId)
        setFullRecipeDetails(fullRecipe || null)
      }
    } catch (error) {
      console.error('Error fetching recipe details:', error)
      setFullRecipeDetails(null)
    } finally {
      setLoadingRecipeDetails(false)
    }
  }

  useEffect(() => {
    fetchMealPlan()
  }, [])

  const handleRemoveRecipe = async (plannedRecipe: PlannedRecipe) => {
    setIsRemoving(true)
    
    try {
      // Optimistic update - remove immediately for better UX
      setMealPlan(prev => {
        if (!prev) return prev
        
        const updatedPlannedRecipes = prev.plannedRecipes.filter(pr => pr.id !== plannedRecipe.id)
        const completedCount = updatedPlannedRecipes.filter(pr => pr.completed).length
        
        return {
          ...prev,
          plannedRecipes: updatedPlannedRecipes,
          totalRecipes: updatedPlannedRecipes.length,
          completedRecipes: completedCount
        }
      })
      
      // Make API call to persist the removal
      const response = await fetch('/api/planner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plannedRecipeId: plannedRecipe.id,
          remove: true
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to remove recipe from meal plan')
      }
      
      console.log('Recipe removed successfully')
      
      // Close the confirmation dialog
      setRecipeToRemove(null)
      
    } catch (error) {
      console.error('Error removing recipe:', error)
      // Revert optimistic update on error
      fetchMealPlan()
    } finally {
      setIsRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 max-w-full">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your meal plan...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-3 sm:p-4 max-w-full">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold mb-2">Error Loading Meal Plan</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchMealPlan}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1">Meal Planner</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {mealPlan?.totalRecipes === 0 
              ? "Plan your meals by chatting with the AI assistant"
              : `${mealPlan?.completedRecipes}/${mealPlan?.totalRecipes} meals completed`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchMealPlan}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {mealPlan && mealPlan.totalRecipes > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                // TODO: Implement clear meal plan in Task 5.2
                console.log('Clear meal plan')
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Plan
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {mealPlan && mealPlan.totalRecipes === 0 && (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-md">
            <div className="text-6xl sm:text-7xl mb-4">📋</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-3">No Meals Planned Yet</h2>
            <p className="text-muted-foreground mb-6">
              Start planning your meals by chatting with the AI assistant. 
              Accept recipe suggestions to add them to your meal plan.
            </p>
            <Button 
              onClick={() => window.location.href = '/assistant'}
              className="px-6"
            >
              Start Planning
            </Button>
          </div>
        </div>
      )}

      {/* Planned Recipes List */}
      {mealPlan && mealPlan.totalRecipes > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 md:gap-6">
            {mealPlan.plannedRecipes.map((plannedRecipe) => (
              <PlannedRecipeCard
                key={plannedRecipe.id}
                plannedRecipe={plannedRecipe}
                onToggleComplete={async (completed) => {
                  // Optimistic update for better UX
                  setMealPlan(prev => {
                    if (!prev) return prev
                    
                    const updatedPlannedRecipes = prev.plannedRecipes.map(pr => 
                      pr.id === plannedRecipe.id 
                        ? { ...pr, completed: completed }
                        : pr
                    )
                    
                    const completedCount = updatedPlannedRecipes.filter(pr => pr.completed).length
                    
                    return {
                      ...prev,
                      plannedRecipes: updatedPlannedRecipes,
                      completedRecipes: completedCount
                    }
                  })
                  
                  // Track meal completion analytics
                  analytics.track('meal_completion_toggled', {
                    recipeId: plannedRecipe.recipe.id,
                    recipeTitle: plannedRecipe.recipe.title,
                    isCompleted: completed,
                    totalMeals: mealPlan?.totalRecipes || 0,
                    completedMeals: completed 
                      ? (mealPlan?.completedRecipes || 0) + 1 
                      : (mealPlan?.completedRecipes || 0) - 1,
                    completionRate: completed 
                      ? ((mealPlan?.completedRecipes || 0) + 1) / (mealPlan?.totalRecipes || 1) * 100
                      : ((mealPlan?.completedRecipes || 0) - 1) / (mealPlan?.totalRecipes || 1) * 100
                  })
                  
                  // Make API call to persist the change
                  try {
                    const response = await fetch('/api/planner', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        plannedRecipeId: plannedRecipe.id,
                        completed: completed
                      })
                    })
                    
                    if (!response.ok) {
                      throw new Error('Failed to update recipe completion status')
                    }
                    
                    console.log('Recipe completion status updated successfully')
                  } catch (error) {
                    console.error('Error updating recipe completion:', error)
                    // Revert optimistic update on error
                    setMealPlan(prev => {
                      if (!prev) return prev
                      
                      const revertedPlannedRecipes = prev.plannedRecipes.map(pr => 
                        pr.id === plannedRecipe.id 
                          ? { ...pr, completed: !completed }
                          : pr
                      )
                      
                      const completedCount = revertedPlannedRecipes.filter(pr => pr.completed).length
                      
                      return {
                        ...prev,
                        plannedRecipes: revertedPlannedRecipes,
                        completedRecipes: completedCount
                      }
                    })
                  }
                }}
                onRemove={() => {
                  setRecipeToRemove(plannedRecipe)
                }}
                onViewRecipe={() => {
                  // Track recipe view analytics
                  analytics.track('recipe_viewed_from_planner', {
                    recipeId: plannedRecipe.recipe.id,
                    recipeTitle: plannedRecipe.recipe.title,
                    isCompleted: plannedRecipe.completed,
                    viewSource: 'planner_card'
                  })
                  
                  setSelectedRecipe(plannedRecipe.recipe)
                  setFullRecipeDetails(null) // Reset previous details
                  fetchFullRecipeDetails(plannedRecipe.recipe.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recipe Details Sheet */}
      {selectedRecipe && (
        <Sheet open={selectedRecipe !== null} onOpenChange={(open) => {
          if (!open) setSelectedRecipe(null)
        }}>
          <SheetContent className="w-[90%] sm:w-[50%] min-w-[320px] p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
            <SheetHeader>
              <SheetTitle className="text-xl sm:text-2xl font-bold">{selectedRecipe?.title}</SheetTitle>
              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Find the planned recipe to toggle completion
                    const plannedRecipe = mealPlan?.plannedRecipes.find(pr => pr.recipe.id === selectedRecipe?.id)
                    if (plannedRecipe) {
                      // Same logic as the card checkbox
                      const newCompleted = !plannedRecipe.completed
                      setMealPlan(prev => {
                        if (!prev) return prev
                        const updatedPlannedRecipes = prev.plannedRecipes.map(pr => 
                          pr.id === plannedRecipe.id 
                            ? { ...pr, completed: newCompleted }
                            : pr
                        )
                        const completedCount = updatedPlannedRecipes.filter(pr => pr.completed).length
                        return {
                          ...prev,
                          plannedRecipes: updatedPlannedRecipes,
                          completedRecipes: completedCount
                        }
                      })
                      
                      // Track meal completion analytics
                      analytics.track('meal_completion_toggled', {
                        recipeId: plannedRecipe.recipe.id,
                        recipeTitle: plannedRecipe.recipe.title,
                        isCompleted: newCompleted,
                        totalMeals: mealPlan?.totalRecipes || 0,
                        completedMeals: newCompleted 
                          ? (mealPlan?.completedRecipes || 0) + 1 
                          : (mealPlan?.completedRecipes || 0) - 1,
                        completionRate: newCompleted 
                          ? ((mealPlan?.completedRecipes || 0) + 1) / (mealPlan?.totalRecipes || 1) * 100
                          : ((mealPlan?.completedRecipes || 0) - 1) / (mealPlan?.totalRecipes || 1) * 100
                      })
                      
                      // Make API call
                      fetch('/api/planner', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          plannedRecipeId: plannedRecipe.id,
                          completed: newCompleted
                        })
                      }).catch(error => {
                        console.error('Error updating recipe completion:', error)
                        // Revert on error
                        setMealPlan(prev => {
                          if (!prev) return prev
                          const revertedPlannedRecipes = prev.plannedRecipes.map(pr => 
                            pr.id === plannedRecipe.id 
                              ? { ...pr, completed: !newCompleted }
                              : pr
                          )
                          const completedCount = revertedPlannedRecipes.filter(pr => pr.completed).length
                          return {
                            ...prev,
                            plannedRecipes: revertedPlannedRecipes,
                            completedRecipes: completedCount
                          }
                        })
                      })
                    }
                  }}
                  className="flex-1"
                >
                  {(() => {
                    const plannedRecipe = mealPlan?.plannedRecipes.find(pr => pr.recipe.id === selectedRecipe?.id)
                    return plannedRecipe?.completed ? "Mark Incomplete" : "Mark Complete"
                  })()}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    // Find the planned recipe to remove
                    const plannedRecipe = mealPlan?.plannedRecipes.find(pr => pr.recipe.id === selectedRecipe?.id)
                    if (plannedRecipe) {
                      setRecipeToRemove(plannedRecipe)
                      setSelectedRecipe(null) // Close the sheet
                    }
                  }}
                  className="flex-1"
                >
                  Remove from Plan
                </Button>
              </div>
            </SheetHeader>
            <div className="flex flex-col gap-4 overflow-y-auto">
              {/* Recipe Meta */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{selectedRecipe.time} min</span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < selectedRecipe.grade ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span>🍽️ Serves 4</span>
                </div>
              </div>

              {/* Recipe Summary */}
              {selectedRecipe.summary && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground leading-relaxed">{selectedRecipe.summary}</p>
                </div>
              )}

              {/* Tags */}
              {selectedRecipe.tags && (() => {
                try {
                  const tags = JSON.parse(selectedRecipe.tags)
                  if (tags.length > 0) {
                    return (
                      <div>
                        <h2 className="text-lg font-semibold mb-2">Tags</h2>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  }
                } catch {
                  return null
                }
                return null
              })()}

              {/* Ingredients */}
              {loadingRecipeDetails ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading recipe details...</span>
                </div>
              ) : fullRecipeDetails ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Ingredients</h2>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                      {fullRecipeDetails.rawIngredients && JSON.parse(fullRecipeDetails.rawIngredients).map((ingredient: string, index: number) => (
                        <li key={index} className="text-sm">{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{fullRecipeDetails.instructions}</p>
                  </div>
                </>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Could not load full recipe details. Please try again.
                  </p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Remove Recipe Confirmation Dialog */}
      <Dialog open={!!recipeToRemove} onOpenChange={(open) => !open && setRecipeToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Recipe from Meal Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{recipeToRemove?.recipe.title}" from your meal plan? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecipeToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => recipeToRemove && handleRemoveRecipe(recipeToRemove)}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Recipe
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 