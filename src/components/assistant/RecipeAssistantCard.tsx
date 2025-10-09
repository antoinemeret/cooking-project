'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Calendar, Eye } from 'lucide-react'
import { TimeDisplay } from '@/components/recipes/TimeDisplay'
import { cn } from '@/lib/utils'
import type { RecipeSuggestion } from '@/lib/assistant/types'

interface RecipeAssistantCardProps {
  recipe: RecipeSuggestion
  onPreview: (recipeId: string) => void
  onSelect: (recipeId: string) => void
  className?: string
  showMatchPercentage?: boolean
}

export function RecipeAssistantCard ({
  recipe,
  onPreview,
  onSelect,
  className,
  showMatchPercentage = true
}: RecipeAssistantCardProps) {
  const [imageError, setImageError] = useState(false)

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPreview(recipe.id)
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(recipe.id)
  }

  return (
    <div
      className={cn(
        'bg-white border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200',
        className
      )}
    >
      {/* Mobile Layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Recipe Image with Match Badge */}
        <div className="relative">
          <button
            onClick={handlePreview}
            className="relative w-full h-[160px] rounded-lg overflow-hidden bg-muted"
            aria-label={`Preview ${recipe.name}`}
          >
            {recipe.imageUrl && !imageError ? (
              <Image
                src={recipe.imageUrl}
                alt={recipe.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Image
                  src="/placeholder-recipe.svg"
                  alt="Recipe placeholder"
                  width={48}
                  height={48}
                  className="opacity-50"
                />
              </div>
            )}
          </button>

          {/* Match Percentage Badge */}
          {showMatchPercentage && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
              {recipe.matchPercentage}% match
            </div>
          )}
        </div>

        {/* Recipe Content */}
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-[#212b36] text-base leading-6 line-clamp-2">
            {recipe.name}
          </h3>

          {/* Footer with Time and Actions */}
          <div className="flex items-center justify-between">
            <TimeDisplay
              preparationTime={recipe.prepTime}
              cookingTime={recipe.cookTime}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors border border-border"
                title="Preview recipe"
                aria-label="Preview recipe"
              >
                <Eye className="h-4 w-4" />
              </button>

              <button
                onClick={handleSelect}
                className="bg-neutral-700 h-8 w-8 rounded-full flex items-center justify-center hover:bg-neutral-800 transition-colors"
                title="Select recipe"
                aria-label="Select recipe for this meal"
              >
                <Calendar className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex gap-4 items-center">
        {/* Recipe Image */}
        <div className="flex-shrink-0 relative">
          <button
            onClick={handlePreview}
            className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
            aria-label={`Preview ${recipe.name}`}
          >
            {recipe.imageUrl && !imageError ? (
              <Image
                src={recipe.imageUrl}
                alt={recipe.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Image
                  src="/placeholder-recipe.svg"
                  alt="Recipe placeholder"
                  width={40}
                  height={40}
                  className="opacity-50"
                />
              </div>
            )}
          </button>

          {/* Match Percentage Badge */}
          {showMatchPercentage && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
              {recipe.matchPercentage}%
            </div>
          )}
        </div>

        {/* Recipe Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h3 className="font-bold text-[#212b36] text-lg leading-6 line-clamp-1">
            {recipe.name}
          </h3>

          <div className="flex gap-2">
            <TimeDisplay
              preparationTime={recipe.prepTime}
              cookingTime={recipe.cookTime}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handlePreview}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors border border-border"
            title="Preview recipe"
            aria-label="Preview recipe"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={handleSelect}
            className="bg-neutral-700 h-8 w-8 rounded-full flex items-center justify-center hover:bg-neutral-800 transition-colors"
            title="Select recipe"
            aria-label="Select recipe for this meal"
          >
            <Calendar className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

