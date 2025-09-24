'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, Star, ThumbsUp, Eye, CalendarPlus } from "lucide-react"
// framer-motion removed for simpler rendering
import { RecipeSheet } from '@/components/recipes/RecipeSheet'
import { RecipeSheetDesktop } from '@/components/recipes/RecipeSheetDesktop'

export interface RecipeSuggestion {
  recipe: {
    id: number
    title: string
    summary: string
    time: number
    grade: number
    tags?: string
    image?: string | null
  }
  reason: string
  confidence: number
}

interface RecipeCardProps {
  suggestion: RecipeSuggestion
  onAccept: (recipeId: number) => void
  onDecline: (recipeId: number, reason?: string) => void
  disabled?: boolean
  className?: string
}

export function RecipeCard({ 
  suggestion, 
  onAccept, 
  onDecline, 
  disabled = false,
  className 
}: RecipeCardProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { recipe, reason } = suggestion
  // Decline options removed per updated design
  const [isSheetOpen, setIsSheetOpen] = useState(false)
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

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      await onAccept(recipe.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async (reason: string) => {
    setIsProcessing(true)
    try {
      await onDecline(recipe.id, reason)
    } finally {
      setIsProcessing(false)
    }
  }

  const renderStars = (grade: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3 w-3",
          i < grade ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ))
  }

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {/* Mobile layout */}
      <div className="space-y-3 md:hidden">
        {/* Hero image */}
        <div className="w-full h-[161px] overflow-hidden rounded-lg bg-muted">
          <img
            src={recipe.image || '/placeholder-recipe.svg'}
            alt={`${recipe.title} recipe image`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.src = '/placeholder-recipe.svg'
              img.onerror = null
            }}
          />
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-[#212b36] text-[18px] leading-[27px]">
            {recipe.title}
          </h3>
          <p className="text-[#212b36] text-[12px] leading-[18px] line-clamp-2">
            {recipe.summary}
          </p>
          <div className="flex gap-2">
            <div className="bg-[#f1f1f1] box-border flex items-center gap-1 px-2 py-1 rounded-[4px] text-[#757575] text-[12px]">
              <Clock className="h-4 w-4 text-[#757575]" />
              <span>~{recipe.time} min</span>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center justify-center gap-2 pt-3">
            <button
              type="button"
              aria-label="View recipe"
              className="h-6 w-6 inline-flex items-center justify-center text-[#212b36]"
              onClick={() => setIsSheetOpen(true)}
              disabled={disabled}
            >
              <Eye className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Add to planner"
              className="h-[25px] w-9 rounded-[18px] bg-[#cff2d7] inline-flex items-center justify-center"
              onClick={handleAccept}
              disabled={disabled}
            >
              <CalendarPlus className="h-4 w-4 text-[#1f7a3f]" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block space-y-3">
        {/* Recipe Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground text-base sm:text-lg mb-1">
              {recipe.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {recipe.summary}
            </p>
          </div>
          {/* Recipe Thumbnail */}
          <div className="flex-shrink-0">
                         <img 
               src={recipe.image || '/placeholder-recipe.svg'} 
               alt={`${recipe.title} recipe image`}
               className="w-16 h-16 object-cover rounded-lg border border-border"
               loading="lazy"
               onError={(e) => {
                 // Fallback to placeholder if image fails to load
                 const img = e.target as HTMLImageElement
                 img.src = '/placeholder-recipe.svg'
                 img.onerror = null // Prevent infinite loop
               }}
             />
          </div>
        </div>

        {/* Recipe Metadata */}
        <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{recipe.time}min</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            <span>{recipe.grade}/3</span>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-muted rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Suggestion Reason */}
        {reason && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 leading-relaxed">
              <span className="font-medium">Why this recipe:</span> {reason}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => setIsSheetOpen(true)}
            disabled={disabled}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button
            onClick={handleAccept}
            disabled={disabled}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
            size="sm"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Accept Recipe
          </Button>
          {/* Decline removed for now */}
        </div>
        {/* Decline options removed */}
      </div>

      {/* Responsive Recipe Sheet */}
      {isSheetOpen && (
        isDesktop ? (
          <RecipeSheetDesktop
            recipe={recipe as any}
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            onAddToPlanner={() => {}}
            onMoreActions={() => {}}
          />
        ) : (
          <RecipeSheet
            recipe={recipe as any}
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            onAddToPlanner={() => {}}
            onMoreActions={() => {}}
          />
        )
      )}
    </div>
  )
} 