'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Eye, CalendarPlus } from 'lucide-react'
import { cn, isValidImageUrl } from '@/lib/utils'
import { TimeDisplay } from '@/components/recipes/TimeDisplay'
import type { RecipeSuggestion } from '@/lib/assistant/types'

interface RecipeAssistantCardProps {
  recipe: RecipeSuggestion
  onPreview: (recipeId: string) => void
  onSelect: (recipeId: string) => void
  className?: string
}

export function RecipeAssistantCard ({
  recipe,
  onPreview,
  onSelect,
  className
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
        'box-border content-stretch flex flex-col gap-3 items-start justify-center p-[12px] relative rounded-[8px] border border-[#dadada] bg-white',
        className
      )}
    >
      
      {/* Hero Picture */}
      <div className="aspect-[329/219.333] bg-white overflow-clip relative rounded-[8px] shrink-0 w-full">
        {recipe.imageUrl && isValidImageUrl(recipe.imageUrl) && !imageError ? (
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
      </div>

      {/* Meta data */}
      <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
        {/* Title */}
        <h3 className="font-['Public_Sans:Bold',_sans-serif] font-bold text-[#212b36] text-[18px] leading-[27px]">
          {recipe.name}
        </h3>

        {/* Description */}
        <p className="font-['Public_Sans:Regular',_sans-serif] font-normal text-[#212b36] text-[12px] leading-[18px]">
          Une délicieuse recette à découvrir.
        </p>

        {/* Footer with Duration tag */}
        <div className="content-stretch flex gap-2 items-start justify-start relative shrink-0 w-full">
          <TimeDisplay 
            preparationTime={recipe.prepTime}
            cookingTime={recipe.cookTime}
          />
        </div>

        {/* Actions */}
        <div className="box-border content-stretch flex gap-3 items-center justify-center px-0 py-3 relative shrink-0 w-full">
          {/* Eye/Preview button */}
          <button
            onClick={handlePreview}
            className="relative shrink-0 size-6 hover:opacity-70 transition-opacity"
            title="Aperçu de la recette"
            aria-label="Aperçu de la recette"
          >
            <Eye className="size-6 text-[#212b36]" />
          </button>

          {/* Calendar/Select button */}
          <button
            onClick={handleSelect}
            className="bg-[#cff2d7] h-[25px] overflow-clip relative rounded-[18px] shrink-0 w-6 hover:bg-[#b8e6c3] transition-colors flex items-center justify-center"
            title="Sélectionner cette recette"
            aria-label="Sélectionner cette recette"
          >
            <CalendarPlus className="absolute left-1/2 size-4 top-1/2 translate-x-[-50%] translate-y-[-50%] text-[#212b36]" />
          </button>
        </div>
      </div>
    </div>
  )
}

