"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw, Trash2, Clock, Calendar, CheckCircle2, Plus, Star, X } from 'lucide-react'
import { TimeDisplay } from '@/components/recipes/TimeDisplay'
import { ServingsDisplay } from '@/components/recipes/ServingsDisplay'
import { RecipeSheet } from '@/components/recipes/RecipeSheet'
import { RecipeSheetDesktop } from '@/components/recipes/RecipeSheetDesktop'
import { cn } from '@/lib/utils'
import { analytics } from '@/lib/analytics'
import { toast } from 'sonner'

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
    image?: string | null
    preparationTime?: number | null
    cookingTime?: number | null
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
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const update = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 1024)
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])
  
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


  return (
    <div className={cn(
      "bg-white rounded-lg p-2 md:p-2 flex items-center gap-3 md:gap-3 transition-all",
      completed && "opacity-60"
    )}>
      {/* Completion Checkbox - Circular */}
      <div className="flex-shrink-0">
        <Checkbox
          checked={completed}
          onCheckedChange={onToggleComplete}
          aria-label={`Mark ${recipe.title} as ${completed ? 'incomplete' : 'complete'}`}
          className="h-5 w-5 rounded-full border-2 border-[#b0b0b0] data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>

      {/* Recipe Image - 68px mobile / 96px desktop */}
      <div className="flex-shrink-0">
        <img 
          src={recipe.image || '/placeholder-recipe.svg'} 
          alt={`${recipe.title} recipe image`}
          className="w-[68px] h-[68px] md:w-32 md:h-32 object-cover rounded-lg"
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            img.src = '/placeholder-recipe.svg'
            img.onerror = null
          }}
        />
      </div>

      {/* Recipe Content - Flexible */}
      <div className="flex-1 min-w-0 flex flex-col gap-1 md:gap-2">
        {/* Recipe Title */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Recipe title clicked:', recipe.title)
            onViewRecipe()
          }}
          className={cn(
            "text-left font-bold text-[16px] md:text-[22px] text-[#212b36] leading-[27px] md:leading-[22px] hover:underline transition-colors cursor-pointer",
            completed && "line-through"
          )}
        >
          {recipe.title}
        </button>

        {/* Subtitle (recipe summary) - Desktop only */}
        {isDesktop && recipe.summary && (
          <p className="text-[16px] leading-[28px] text-[#212b36] line-clamp-2">
            {recipe.summary}
          </p>
        )}

        {/* Duration and Servings Tags */}
        <div className="flex gap-2 md:mt-2 items-center">
          {/* Time Display - shows prep and cooking times separately when available */}
          <TimeDisplay 
            preparationTime={recipe.preparationTime}
            cookingTime={recipe.cookingTime}
          />

          {/* Servings Tag */}
          <ServingsDisplay servings={4} />
        </div>
      </div>

      {/* Remove Button - 38x38px */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 w-[38px] h-[38px] flex items-center justify-center hover:opacity-80 transition-opacity"
        aria-label={`Remove ${recipe.title} from planner`}
      >
        <X className="h-6 w-6 text-[#212b36]" />
      </button>
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
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const userId = 'user123' // TODO: Replace with actual user ID
  const [isClearing, setIsClearing] = useState(false)

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
          tags: '["Italian", "Pasta", "Quick"]',
          preparationTime: 10,
          cookingTime: 15
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
          tags: '["Salad", "Vegetarian", "Light"]',
          preparationTime: 10,
          cookingTime: 5
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
          tags: '["Protein", "Healthy", "Grilled"]',
          preparationTime: 15,
          cookingTime: 15
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
      <div className="container mx-auto p-3 sm:p-4 max-w-full pb-20 lg:pb-4">
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
      <div className="container mx-auto p-3 sm:p-4 max-w-full pb-20 lg:pb-4">
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
    <div className="container mx-auto p-3 sm:p-4 max-w-full pb-20 lg:pb-4">
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
              onClick={async () => {
                setIsClearing(true)
                try {
                  const res = await fetch(`/api/planner?userId=${userId}`, { method: 'DELETE' })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Failed to clear meal plan')
                  }
                  toast(
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <span>Meal plan cleared</span>
                    </div>
                  )
                  await fetchMealPlan()
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to clear meal plan')
                } finally {
                  setIsClearing(false)
                }
              }}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive mr-2"></span>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Plan
                </>
              )}
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
                  setIsSheetOpen(true)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recipe Sheet - Responsive */}
      {selectedRecipe && (() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
        
        if (isMobile) {
          return (
            <div style={{ border: '2px solid red' }}>
              <div style={{ background: 'yellow', padding: '10px', margin: '10px' }}>
                MOBILE VERSION - RecipeSheet (Width: {typeof window !== 'undefined' ? window.innerWidth : 'unknown'}px)
              </div>
              <RecipeSheet
                recipe={selectedRecipe}
                isOpen={isSheetOpen}
                onClose={() => {
                  setIsSheetOpen(false)
                  setSelectedRecipe(null)
                }}
                onAddToPlanner={(recipeId) => {
                  // Already in planner, could show a toast or do nothing
                  toast.info('Recipe is already in your planner')
                }}
                onMoreActions={(recipeId, action) => {
                  if (action === 'delete') {
                    const plannedRecipe = mealPlan?.plannedRecipes.find(pr => pr.recipe.id === recipeId)
                    if (plannedRecipe) {
                      setRecipeToRemove(plannedRecipe)
                      setIsSheetOpen(false)
                    }
                  }
                }}
              />
            </div>
          )
        } else {
          return (
            <div style={{ border: '2px solid blue' }}>
              <div style={{ background: 'lightblue', padding: '10px', margin: '10px' }}>
                DESKTOP VERSION - RecipeSheetDesktop (Width: {typeof window !== 'undefined' ? window.innerWidth : 'unknown'}px)
              </div>
              <RecipeSheetDesktop
                recipe={selectedRecipe}
                isOpen={isSheetOpen}
                onClose={() => {
                  setIsSheetOpen(false)
                  setSelectedRecipe(null)
                }}
                onAddToPlanner={(recipeId) => {
                  // Already in planner, could show a toast or do nothing
                  toast.info('Recipe is already in your planner')
                }}
                onMoreActions={(recipeId, action) => {
                  if (action === 'delete') {
                    const plannedRecipe = mealPlan?.plannedRecipes.find(pr => pr.recipe.id === recipeId)
                    if (plannedRecipe) {
                      setRecipeToRemove(plannedRecipe)
                      setIsSheetOpen(false)
                    }
                  }
                }}
              />
            </div>
          )
        }
      })()}

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