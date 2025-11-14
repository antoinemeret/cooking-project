'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Calendar, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { TimeDisplay } from '@/components/recipes/TimeDisplay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isValidImageUrl } from '@/lib/utils'
import type { RecipeSuggestion } from '@/lib/assistant/types'

interface Recipe {
  id: number
  title: string
  summary: string
  image?: string | null
  preparationTime?: number | null
  cookingTime?: number | null
  rawIngredients: string
  instructions: string
  tags: string
}

interface RecipePreviewDrawerProps {
  recipeId: string | null
  isOpen: boolean
  onClose: () => void
  onSelect: (recipe: RecipeSuggestion) => void
}

export function RecipePreviewDrawer ({
  recipeId,
  isOpen,
  onClose,
  onSelect
}: RecipePreviewDrawerProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  // Fetch recipe details when drawer opens
  useEffect(() => {
    if (!recipeId || !isOpen) {
      setRecipe(null)
      setError(null)
      setImageError(false)
      return
    }

    const fetchRecipe = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/recipes/${recipeId}`)

        if (!response.ok) {
          throw new Error('Failed to fetch recipe details')
        }

        const data = await response.json()
        setRecipe(data.recipe)
      } catch (err) {
        console.error('Error fetching recipe:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecipe()
  }, [recipeId, isOpen])

  const handleSelect = () => {
    if (recipe) {
      // Convert Recipe to RecipeSuggestion
      const recipeSuggestion: RecipeSuggestion = {
        id: recipe.id.toString(),
        name: recipe.title,
        imageUrl: recipe.image || undefined,
        prepTime: recipe.preparationTime || undefined,
        cookTime: recipe.cookingTime || undefined,
        matchPercentage: 100 // Since it's selected from suggestions, assume 100% match
      }
      onSelect(recipeSuggestion)
      onClose()
    }
  }

  // Parse ingredients
  let ingredients: string[] = []
  if (recipe?.rawIngredients) {
    try {
      ingredients = JSON.parse(recipe.rawIngredients)
    } catch {
      ingredients = []
    }
  }

  // Parse tags
  let tags: string[] = []
  if (recipe?.tags) {
    try {
      tags = JSON.parse(recipe.tags)
    } catch {
      tags = []
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="!max-h-[95vh] !h-[95vh] !mt-0 [&[data-vaul-drawer-direction=bottom]]:!max-h-[95vh] [&[data-vaul-drawer-direction=bottom]]:!mt-0">
        <DrawerHeader className="text-left border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-xl font-bold leading-7">
                {isLoading ? 'Chargement...' : recipe?.title || 'Recette'}
              </DrawerTitle>
              {recipe?.summary && (
                <DrawerDescription className="mt-2">
                  {recipe.summary}
                </DrawerDescription>
              )}
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : recipe ? (
            <div className="space-y-6">
              {/* Recipe Image */}
              {recipe.image && isValidImageUrl(recipe.image) && (
                <div className="relative w-full h-[200px] rounded-lg overflow-hidden bg-muted">
                  {!imageError ? (
                    <Image
                      src={recipe.image}
                      alt={recipe.title}
                      fill
                      className="object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Image
                        src="/placeholder-recipe.svg"
                        alt="Recipe placeholder"
                        width={64}
                        height={64}
                        className="opacity-50"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Time Display */}
              <div className="flex gap-2">
                <TimeDisplay
                  preparationTime={recipe.preparationTime}
                  cookingTime={recipe.cookingTime}
                />
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-[#212b36]">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-[#212b36]">Ingrédients</h3>
                  <ul className="space-y-1 text-sm">
                    {ingredients.map((ingredient: string, index: number) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructions */}
              {recipe.instructions && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-[#212b36]">Instructions</h3>
                  <div className="text-sm whitespace-pre-wrap text-[#212b36]">
                    {recipe.instructions}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DrawerFooter className="border-t pt-4">
          <Button
            onClick={handleSelect}
            disabled={isLoading || !!error}
            className="w-full"
            size="lg"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Sélectionner cette recette
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

