'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Lightbulb, MessageCircle, UtensilsCrossed, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingTipsProps {
  onDismiss: () => void
  className?: string
}

export function OnboardingTips({ onDismiss, className }: OnboardingTipsProps) {
  const [currentTip, setCurrentTip] = useState(0)

  const tips = [
    {
      icon: MessageCircle,
      title: "Chat naturally with me!",
      description: "Just tell me what you need: 'I want something quick for dinner' or 'Plan 5 meals for this week'",
      example: "💬 'I need vegetarian meals for the week'"
    },
    {
      icon: UtensilsCrossed,
      title: "I suggest from YOUR recipes",
      description: "I only recommend recipes you've already saved, so everything will match your taste and dietary needs.",
      example: "🍝 I'll suggest your saved pasta recipes"
    },
    {
      icon: Calendar,
      title: "Accept or decline suggestions",
      description: "For each recipe I suggest, you can accept it for your meal plan or ask for something different.",
      example: "✅ Accept → 📋 Added to your planner"
    }
  ]

  const currentTipData = tips[currentTip]
  const Icon = currentTipData.icon

  const nextTip = () => {
    if (currentTip < tips.length - 1) {
      setCurrentTip(currentTip + 1)
    } else {
      onDismiss()
    }
  }

  const skipTips = () => {
    onDismiss()
  }

  return (
    <div className={cn(
      "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4",
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Getting Started</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={skipTips}
          className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="bg-blue-100 rounded-full p-2 flex-shrink-0">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {currentTipData.title}
          </h3>
          <p className="text-sm text-gray-700 mb-2">
            {currentTipData.description}
          </p>
          <div className="bg-white/70 rounded-md px-3 py-2 text-sm text-gray-600 border border-blue-100">
            {currentTipData.example}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {tips.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === currentTip ? "bg-blue-600" : "bg-blue-200"
              )}
            />
          ))}
        </div>
        
        <div className="flex gap-2">
          {currentTip > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentTip(currentTip - 1)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Previous
            </Button>
          )}
          <Button
            onClick={nextTip}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {currentTip === tips.length - 1 ? "Get Started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
} 