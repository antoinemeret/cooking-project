'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TagInput } from '@/components/ui/tag-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { ChevronDown, X, Clock, Users, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ConstraintType,
  DishTypeSchema,
  DietaryRestrictionsSchema,
  CuisineStyleSchema,
  CookingMethodSchema,
  MealContextSchema
} from '@/lib/assistant/types'

// French labels for constraint types
const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  mealCount: 'Nombre de repas',
  includeIngredients: 'Ingrédients à inclure',
  excludeIngredients: 'Ingrédients à exclure',
  dishType: 'Type de plat',
  dietaryRestrictions: 'Restrictions alimentaires',
  cuisineStyle: 'Style de cuisine',
  maxPrepTime: 'Temps de préparation max',
  maxCookTime: 'Temps de cuisson max',
  cookingMethod: 'Mode de cuisson',
  servings: 'Nombre de personnes',
  mealContext: 'Contexte du repas'
}

// French labels for enum values
const DISH_TYPE_LABELS: Record<string, string> = {
  appetizer: 'Entrée',
  main: 'Plat principal',
  dessert: 'Dessert',
  side: 'Accompagnement',
  salad: 'Salade',
  soup: 'Soupe',
  pasta: 'Pâtes',
  pizza: 'Pizza',
  sandwich: 'Sandwich',
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation'
}

const DIETARY_LABELS: Record<string, string> = {
  vegetarian: 'Végétarien',
  vegan: 'Végétalien',
  'gluten-free': 'Sans gluten',
  'dairy-free': 'Sans lactose',
  'nut-free': 'Sans noix',
  'soy-free': 'Sans soja',
  keto: 'Keto',
  paleo: 'Paleo',
  'low-carb': 'Faible en glucides',
  'low-fat': 'Faible en gras',
  'high-protein': 'Riche en protéines',
  halal: 'Halal',
  kosher: 'Casher'
}

const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italien',
  french: 'Français',
  mexican: 'Mexicain',
  chinese: 'Chinois',
  japanese: 'Japonais',
  indian: 'Indien',
  thai: 'Thaï',
  lebanese: 'Libanais',
  mediterranean: 'Méditerranéen',
  american: 'Américain',
  greek: 'Grec',
  spanish: 'Espagnol',
  german: 'Allemand',
  korean: 'Coréen'
}

const COOKING_METHOD_LABELS: Record<string, string> = {
  oven: 'Four',
  stovetop: 'Cuisinière',
  grill: 'Grill',
  raw: 'Cru',
  steam: 'Vapeur',
  fry: 'Friture',
  bake: 'Cuisson au four',
  roast: 'Rôtir',
  boil: 'Bouillir',
  sauté: 'Sauté',
  'slow-cook': 'Mijoteuse',
  'pressure-cook': 'Autocuiseur'
}

const MEAL_CONTEXT_LABELS: Record<string, string> = {
  'quick-dinner': 'Dîner rapide',
  'dinner-party': 'Dîner entre amis',
  'meal-prep': 'Préparation de repas',
  'weekend-cooking': 'Cuisine du weekend',
  'comfort-food': 'Cuisine réconfortante',
  healthy: 'Sain',
  indulgent: 'Gourmand',
  'family-friendly': 'Familial',
  romantic: 'Romantique',
  casual: 'Décontracté'
}

interface ConstraintCardProps {
  type: ConstraintType
  value?: any
  onChange: (value: any) => void
  onRemove?: () => void
  showRemove?: boolean
  className?: string
}

export function ConstraintCard({
  type,
  value,
  onChange,
  onRemove,
  showRemove = false,
  className
}: ConstraintCardProps) {
  const label = CONSTRAINT_LABELS[type]

  // Ingredient inputs (TagInput)
  if (type === 'includeIngredients' || type === 'excludeIngredients') {
    const tags = Array.isArray(value) ? value : []
    
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          {showRemove && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <TagInput
          tags={tags}
          onTagsChange={onChange}
          placeholder={type === 'includeIngredients' ? 'Ajouter un ingrédient...' : 'Exclure un ingrédient...'}
          allowCreate
          maxTags={20}
        />
      </div>
    )
  }

  // Multi-select dropdowns
  if (
    type === 'dishType' ||
    type === 'dietaryRestrictions' ||
    type === 'cuisineStyle' ||
    type === 'cookingMethod' ||
    type === 'mealContext'
  ) {
    const selectedValues = Array.isArray(value) ? value : []
    
    let options: string[] = []
    let labelMap: Record<string, string> = {}
    
    switch (type) {
      case 'dishType':
        options = DishTypeSchema.options
        labelMap = DISH_TYPE_LABELS
        break
      case 'dietaryRestrictions':
        options = DietaryRestrictionsSchema.options
        labelMap = DIETARY_LABELS
        break
      case 'cuisineStyle':
        options = CuisineStyleSchema.options
        labelMap = CUISINE_LABELS
        break
      case 'cookingMethod':
        options = CookingMethodSchema.options
        labelMap = COOKING_METHOD_LABELS
        break
      case 'mealContext':
        options = MealContextSchema.options
        labelMap = MEAL_CONTEXT_LABELS
        break
    }

    const handleToggle = (option: string) => {
      const newValues = selectedValues.includes(option)
        ? selectedValues.filter(v => v !== option)
        : [...selectedValues, option]
      onChange(newValues)
    }

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          {showRemove && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              size="sm"
            >
            <span className="truncate">
              {selectedValues.filter(val => val.trim() !== '').length > 0
                ? `${selectedValues.filter(val => val.trim() !== '').length} sélectionné${selectedValues.filter(val => val.trim() !== '').length > 1 ? 's' : ''}`
                : 'Aucune sélection'}
            </span>
              <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={selectedValues.includes(option)}
                onCheckedChange={() => handleToggle(option)}
              >
                {labelMap[option] || option}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Display selected values as badges */}
        {selectedValues.filter(val => val.trim() !== '').length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedValues.filter(val => val.trim() !== '').map((val) => (
              <Badge
                key={val}
                variant="secondary"
                className="text-xs"
              >
                {labelMap[val] || val}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Number inputs (time, servings)
  if (type === 'maxPrepTime' || type === 'maxCookTime') {
    const numValue = typeof value === 'number' ? value : undefined

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {label}
          </label>
          {showRemove && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={480}
            step={5}
            value={numValue || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              // Use 0 for empty values to keep constraint visible
              onChange(isNaN(val) ? 0 : val)
            }}
            placeholder="0"
            className="text-sm"
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>
      </div>
    )
  }

  if (type === 'servings') {
    const numValue = typeof value === 'number' ? value : undefined

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            {label}
          </label>
          {showRemove && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 px-2 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const currentValue = numValue || 2
              const newValue = Math.max(1, currentValue - 1)
              onChange(newValue)
            }}
            className="h-8 w-8 p-0"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={20}
            value={numValue || 2}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              // Use 2 for empty values to keep constraint visible with reasonable default
              onChange(isNaN(val) ? 2 : val)
            }}
            placeholder="2"
            className="text-sm w-16 text-center"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const currentValue = numValue || 2
              const newValue = Math.min(20, currentValue + 1)
              onChange(newValue)
            }}
            className="h-8 w-8 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">pers.</span>
        </div>
      </div>
    )
  }

  // Meal count handled separately in ConstraintSection
  return null
}
