'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimeDisplay } from './TimeDisplay'
import { RecipeActionsDrawer } from './RecipeActionsDrawer'
import { RecipeSheet } from './RecipeSheet'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Recipe {
  id: number
  title: string
  summary: string
  time: number
  image?: string | null
  preparationTime?: number | null
  cookingTime?: number | null
  ingredients?: string[]
  instructions?: string
}

interface RecipeCardProps {
  recipe: Recipe
  onAddToPlanner?: (recipeId: number) => void
  onMoreActions?: (recipeId: number, action: string) => void
  className?: string
}

export function RecipeCard({ 
  recipe, 
  onAddToPlanner, 
  onMoreActions,
  className 
}: RecipeCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const handleAddToPlanner = () => {
    onAddToPlanner?.(recipe.id)
  }

  const handleMoreAction = (action: string) => {
    onMoreActions?.(recipe.id, action)
  }

  return (
    <div className={cn(
      "bg-white border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200",
      className
    )}>
      {/* Mobile Layout: Image on top, content below */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Recipe Image - Mobile */}
        <button
          onClick={() => setIsSheetOpen(true)}
          className="relative w-full h-[180px] rounded-lg overflow-hidden bg-muted"
        >
          {recipe.image && !imageError ? (
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
                width={48}
                height={48}
                className="opacity-50"
              />
            </div>
          )}
        </button>

        {/* Recipe Content - Mobile */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsSheetOpen(true)}
            className="text-left"
          >
            <h3 className="font-bold text-[#212b36] text-[18px] leading-[27px] line-clamp-1 hover:text-primary transition-colors">
              {recipe.title}
            </h3>
          </button>
          {recipe.summary && (
            <p className="text-[#212b36] text-[12px] leading-[18px] line-clamp-2 h-9">
              {recipe.summary}
            </p>
          )}
          
          {/* Footer with Time Display and Actions - Mobile */}
          <div className="flex items-center justify-between">
            <TimeDisplay 
              preparationTime={recipe.preparationTime}
              cookingTime={recipe.cookingTime}
            />
            
            {/* Action Buttons - Mobile */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToPlanner}
                className="bg-neutral-700 h-6 w-6 rounded-[18px] flex items-center justify-center hover:bg-neutral-800 transition-colors"
                title="Add to planner"
              >
                <Calendar className="h-4 w-4 text-white" />
              </button>
              
              <RecipeActionsDrawer
                recipe={recipe}
                onEdit={(id) => handleMoreAction('edit')}
                onAddToFavorites={(id) => handleMoreAction('favorites')}
                onAddToPlanner={(id) => handleMoreAction('planner')}
                onDelete={(id) => handleMoreAction('delete')}
              >
                <button
                  className="h-6 w-6 rounded-[18px] flex items-center justify-center hover:bg-muted transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </RecipeActionsDrawer>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout: Image on left, content in middle, actions on right */}
      <div className="hidden sm:flex gap-5 items-center">
        {/* Recipe Image - Desktop */}
        <div className="flex-shrink-0">
          <Link href={`/recipes/${recipe.id}`}>
            <div className="relative w-40 h-40 rounded-2xl overflow-hidden bg-muted">
              {recipe.image && !imageError ? (
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
                    width={48}
                    height={48}
                    className="opacity-50"
                  />
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Recipe Content - Desktop */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Link href={`/recipes/${recipe.id}`}>
            <h3 className="font-bold text-[#212b36] text-xl leading-7 line-clamp-1 hover:text-primary transition-colors">
              {recipe.title}
            </h3>
          </Link>
          {recipe.summary && (
            <p className="text-[#212b36] text-sm leading-5 line-clamp-2">
              {recipe.summary}
            </p>
          )}
          
          {/* Time Display */}
          <div className="flex gap-2">
            <TimeDisplay 
              preparationTime={recipe.preparationTime}
              cookingTime={recipe.cookingTime}
            />
          </div>
        </div>

        {/* Action Buttons - Desktop */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAddToPlanner}
            className="bg-neutral-700 h-6 w-6 rounded-[18px] flex items-center justify-center hover:bg-neutral-800 transition-colors"
            title="Add to planner"
          >
            <Calendar className="h-4 w-4 text-white" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-6 w-6 rounded-[18px] flex items-center justify-center hover:bg-muted transition-colors"
                title="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleMoreAction('edit')}>
                Edit Recipe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMoreAction('duplicate')}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMoreAction('share')}>
                Share
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleMoreAction('delete')}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Recipe Sheet for Mobile */}
      <RecipeSheet
        recipe={recipe}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onAddToPlanner={onAddToPlanner}
        onMoreActions={onMoreActions}
      />
    </div>
  )
}
