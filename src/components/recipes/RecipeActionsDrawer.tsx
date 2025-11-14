'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { SquarePen, Heart, CalendarPlus, Trash2 } from 'lucide-react'
import { cn, isValidImageUrl } from '@/lib/utils'

interface Recipe {
  id: number
  title: string
  summary: string
  time: number
  image?: string | null
  preparationTime?: number | null
  cookingTime?: number | null
}

interface RecipeActionsDrawerProps {
  recipe: Recipe
  onEdit?: (recipeId: number) => void
  onAddToFavorites?: (recipeId: number) => void
  onAddToPlanner?: (recipeId: number) => void
  onDelete?: (recipeId: number) => void
  onOpenSheet?: (recipeId: number, action?: string) => void
  children: React.ReactNode
}

export function RecipeActionsDrawer({
  recipe,
  onEdit,
  onAddToFavorites,
  onAddToPlanner,
  onDelete,
  onOpenSheet,
  children
}: RecipeActionsDrawerProps) {
  const [imageError, setImageError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleAction = (action: string) => {
    switch (action) {
      case 'edit':
        // Close drawer and open the sheet for edit action
        setIsOpen(false)
        onOpenSheet?.(recipe.id, 'edit')
        break
      case 'favorites':
        onAddToFavorites?.(recipe.id)
        break
      case 'planner':
        onAddToPlanner?.(recipe.id)
        break
      case 'delete':
        // Close drawer and open the sheet for delete action to show confirmation dialog
        setIsOpen(false)
        onOpenSheet?.(recipe.id)
        break
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="h-[400px]">
        {/* Header with recipe image and title */}
        <div className="px-7 pt-6 pb-0">
          <div className="flex gap-2 items-center">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {recipe.image && isValidImageUrl(recipe.image) && !imageError ? (
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
                    width={24}
                    height={24}
                    className="opacity-50"
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[#212b36] text-[18px] leading-[27px] line-clamp-1">
                {recipe.title}
              </h3>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-7 pt-6 pb-8">
          <div className="flex flex-col gap-4">
            {/* Edit */}
            <button
              onClick={() => handleAction('edit')}
              className="flex gap-3 items-center text-left hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <SquarePen className="w-6 h-6 text-[#212b36]" />
              </div>
              <span className="font-normal text-[#212b36] text-base leading-5">
                Modifier
              </span>
            </button>

            {/* Add to favorites */}
            <button
              onClick={() => handleAction('favorites')}
              className="flex gap-3 items-center text-left hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <Heart className="w-6 h-6 text-[#212b36]" />
              </div>
              <span className="font-normal text-[#212b36] text-base leading-5">
                Ajouter en favori
              </span>
            </button>

            {/* Add to planner */}
            <button
              onClick={() => handleAction('planner')}
              className="flex gap-3 items-center text-left hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <CalendarPlus className="w-6 h-6 text-[#212b36]" />
              </div>
              <span className="font-normal text-[#212b36] text-base leading-5">
                Ajouter au planning
              </span>
            </button>

            {/* Delete */}
            <button
              onClick={() => handleAction('delete')}
              className="flex gap-3 items-center text-left hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-[#212b36]" />
              </div>
              <span className="font-normal text-[#212b36] text-base leading-5">
                Supprimer
              </span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
