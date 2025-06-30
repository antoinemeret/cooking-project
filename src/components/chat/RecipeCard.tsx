'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, Star, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from "lucide-react"
import { motion } from "framer-motion"

export interface RecipeSuggestion {
  recipe: {
    id: number
    title: string
    summary: string
    time: number
    grade: number
    tags?: string
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
  const [showDeclineOptions, setShowDeclineOptions] = useState(false)
  const declineReasons = ["I'm not in the mood for cooking", "I'm not feeling well", "I'm busy", "I'm not hungry"]

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
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        duration: 0.4,
        ease: "easeOut"
      }}
      className={cn(
        "bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <div className="space-y-3">
        {/* Recipe Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground text-base sm:text-lg mb-1">
              {recipe.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {recipe.summary}
            </p>
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
            onClick={handleAccept}
            disabled={disabled}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
            size="sm"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Accept Recipe
          </Button>
          <Button
            onClick={() => setShowDeclineOptions(!showDeclineOptions)}
            disabled={disabled}
            variant="outline"
            className="flex-1 border-red-200 text-red-700 hover:bg-red-50 transition-colors duration-200"
            size="sm"
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Decline
            {showDeclineOptions ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
        </div>

        {/* Decline Options */}
        {showDeclineOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 pt-2 border-t border-border"
          >
            <p className="text-sm text-muted-foreground">
              Why don't you want this recipe? (This helps me suggest better options)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {declineReasons.map((reason) => (
                <Button
                  key={reason}
                  onClick={() => handleDecline(reason)}
                  disabled={disabled}
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start hover:bg-muted transition-colors duration-150"
                >
                  {reason}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
} 