'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TagInput } from '@/components/ui/tag-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
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
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const label = CONSTRAINT_LABELS[type]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

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
        
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="outline"
            className="w-full justify-between h-auto min-h-9 p-2"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedValues.filter(val => val.trim() !== '').length > 0 ? (
                selectedValues
                  .filter(val => val.trim() !== '')
                  .map((value, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 h-6"
                    >
                      {labelMap[value] || value}
                    </Badge>
                  ))
              ) : (
                <span className="text-muted-foreground text-sm">Aucune sélection</span>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 ml-2 opacity-50 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
          </Button>
          
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option)
                return (
                  <div
                    key={option}
                    className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer"
                    onClick={() => {
                      handleToggle(option)
                      setIsOpen(false) // Close immediately
                    }}
                  >
                    <span className="text-sm">{labelMap[option] || option}</span>
                    <div className={cn(
                      "w-4 h-4 border rounded flex items-center justify-center",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

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
