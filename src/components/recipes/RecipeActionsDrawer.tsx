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
import { cn } from '@/lib/utils'

// Icons from Figma
const imgLucideSquarePen = "http://localhost:3845/assets/7e3d73e37d9ad66bf62d0709bc6333d76ee9c1dc.svg"
const imgLucideHeart = "http://localhost:3845/assets/4a1ad08b62facbc2c95c3e9481b727647952505d.svg"
const imgLucideCalendarPlus = "http://localhost:3845/assets/c723c26a3d134af12c1c73beb11809bc5d926334.svg"
const imgLucideTrash2 = "http://localhost:3845/assets/9ff76882fe31ca63ef622b2fd64e5ce180db9779.svg"

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
  children: React.ReactNode
}

export function RecipeActionsDrawer({
  recipe,
  onEdit,
  onAddToFavorites,
  onAddToPlanner,
  onDelete,
  children
}: RecipeActionsDrawerProps) {
  const [imageError, setImageError] = useState(false)

  const handleAction = (action: string) => {
    switch (action) {
      case 'edit':
        onEdit?.(recipe.id)
        break
      case 'favorites':
        onAddToFavorites?.(recipe.id)
        break
      case 'planner':
        onAddToPlanner?.(recipe.id)
        break
      case 'delete':
        onDelete?.(recipe.id)
        break
    }
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="h-[400px]">
        {/* Header with recipe image and title */}
        <div className="px-7 pt-6 pb-0">
          <div className="flex gap-2 items-center">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
                <img 
                  alt="Edit icon" 
                  className="w-full h-full" 
                  src={imgLucideSquarePen} 
                />
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
                <img 
                  alt="Heart icon" 
                  className="w-full h-full" 
                  src={imgLucideHeart} 
                />
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
                <img 
                  alt="Calendar plus icon" 
                  className="w-full h-full" 
                  src={imgLucideCalendarPlus} 
                />
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
                <img 
                  alt="Trash icon" 
                  className="w-full h-full" 
                  src={imgLucideTrash2} 
                />
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
