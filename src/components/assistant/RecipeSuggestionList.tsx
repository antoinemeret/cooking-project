'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { RecipeAssistantCard } from './RecipeAssistantCard'
import { RecipePreviewDrawer } from './RecipePreviewDrawer'
import { useAssistantStore } from '@/lib/assistant/state'
import type { SuggestionSections, RecipeSuggestion } from '@/lib/assistant/types'

interface RecipeSuggestionListProps {
  mealIndex: number
  onRecipeSelect: (recipe: RecipeSuggestion) => void
}

export function RecipeSuggestionList ({
  mealIndex,
  onRecipeSelect
}: RecipeSuggestionListProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionSections | null>(null)
  const [offset, setOffset] = useState(0)
  const [previewRecipeId, setPreviewRecipeId] = useState<string | null>(null)

  const constraints = useAssistantStore(state => state.constraints)
  const generalConstraints = constraints?.general
  const perMealConstraints = constraints?.perMeal[mealIndex]

  // Fetch suggestions on mount or when constraints change
  useEffect(() => {
    if (!perMealConstraints) return

    const fetchSuggestions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/recipes/suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            constraints: perMealConstraints,
            generalConstraints,
            offset: 0,
            limit: 8
          })
        })

        if (!response.ok) {
          throw new Error('Failed to fetch recipe suggestions')
        }

        const data = await response.json()
        setSuggestions(data)
        setOffset(8)
      } catch (err) {
        console.error('Error fetching suggestions:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSuggestions()
  }, [perMealConstraints, generalConstraints])

  // Load more suggestions
  const handleLoadMore = async () => {
    if (!perMealConstraints || !suggestions) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          constraints: perMealConstraints,
          generalConstraints,
          offset,
          limit: 5
        })
      })

      if (!response.ok) {
        throw new Error('Failed to load more suggestions')
      }

      const data: SuggestionSections = await response.json()

      // Append new suggestions
      setSuggestions({
        perfectMatches: [...suggestions.perfectMatches, ...data.perfectMatches],
        partialMatches: [...suggestions.partialMatches, ...data.partialMatches],
        hasMore: data.hasMore
      })
      setOffset(prev => prev + 5)
    } catch (err) {
      console.error('Error loading more suggestions:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handlePreview = (recipeId: string) => {
    setPreviewRecipeId(recipeId)
  }

  const handleClosePreview = () => {
    setPreviewRecipeId(null)
  }

  const handleSelectFromCard = (recipeId: string) => {
    // Find the recipe from current suggestions
    if (!suggestions) return
    const allRecipes = [...suggestions.perfectMatches, ...suggestions.partialMatches]
    const recipe = allRecipes.find(r => r.id === recipeId)
    if (recipe) {
      onRecipeSelect(recipe)
    }
  }

  const handleSelectFromDrawer = (recipe: RecipeSuggestion) => {
    onRecipeSelect(recipe)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Recherche de recettes correspondant à vos consignes...
        </p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // No suggestions
  if (!suggestions) return null

  const totalRecipes = suggestions.perfectMatches.length + suggestions.partialMatches.length

  // Empty state
  if (totalRecipes === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">Aucune recette ne correspond</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Aucune recette ne correspond à vos consignes. Essayez de modifier vos critères
            pour obtenir plus de résultats.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            // Navigate back to constraint editing
            window.history.back()
          }}
        >
          Modifier les consignes
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Perfect Matches Section */}
      {suggestions.perfectMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#212b36]">
              Correspondances parfaites
            </h2>
            <span className="text-sm text-muted-foreground">
              ({suggestions.perfectMatches.length})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {suggestions.perfectMatches.map(recipe => (
              <RecipeAssistantCard
                key={recipe.id}
                recipe={recipe}
                onPreview={handlePreview}
                onSelect={handleSelectFromCard}
              />
            ))}
          </div>
        </div>
      )}

      {/* Partial Matches Section */}
      {suggestions.partialMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#212b36]">
              Autres suggestions
            </h2>
            <span className="text-sm text-muted-foreground">
              ({suggestions.partialMatches.length})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {suggestions.partialMatches.map(recipe => (
              <RecipeAssistantCard
                key={recipe.id}
                recipe={recipe}
                onPreview={handlePreview}
                onSelect={handleSelectFromCard}
              />
            ))}
          </div>
        </div>
      )}

      {/* Load More Button */}
      {suggestions.hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Chargement...
              </>
            ) : (
              'Afficher 5 recettes de plus'
            )}
          </Button>
        </div>
      )}

      {/* Recipe Preview Drawer */}
      <RecipePreviewDrawer
        recipeId={previewRecipeId}
        isOpen={previewRecipeId !== null}
        onClose={handleClosePreview}
        onSelect={handleSelectFromDrawer}
      />
    </div>
  )
}

