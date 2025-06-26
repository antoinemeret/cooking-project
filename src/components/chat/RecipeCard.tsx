import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, Star } from "lucide-react"

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

  const handleDecline = async () => {
    setIsProcessing(true)
    try {
      await onDecline(recipe.id)
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
    <div className={cn(
      "border rounded-lg p-4 bg-card text-card-foreground shadow-sm mb-3",
      disabled && "opacity-60",
      className
    )}>
      {/* Recipe Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-base leading-tight pr-2">
          {recipe.title}
        </h3>
        <div className="flex items-center space-x-1 flex-shrink-0">
          {renderStars(recipe.grade)}
        </div>
      </div>

      {/* Recipe Summary */}
      {recipe.summary && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {recipe.summary}
        </p>
      )}

      {/* Recipe Meta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>{recipe.time} min</span>
          </div>
        </div>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* AI Reason */}
      {reason && (
        <div className="bg-muted/50 rounded-md p-2 mb-3">
          <p className="text-xs text-muted-foreground italic">
            💡 {reason}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <Button
          onClick={handleAccept}
          disabled={disabled || isProcessing}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          {isProcessing ? "Adding..." : "✓ Accept"}
        </Button>
        <Button
          onClick={handleDecline}
          disabled={disabled || isProcessing}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          {isProcessing ? "..." : "✗ Skip"}
        </Button>
      </div>
    </div>
  )
} 