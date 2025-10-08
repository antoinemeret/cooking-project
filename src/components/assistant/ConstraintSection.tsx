import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Users, Utensils, Plus, Minus } from 'lucide-react'
import { Constraints, GeneralConstraints, PerMealConstraints, ConstraintType } from '@/lib/assistant/types'
import { ConstraintCard } from './ConstraintCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

interface ConstraintSectionProps {
  constraints: Constraints
  onUpdateGeneral: (updates: Partial<GeneralConstraints>) => void
  onUpdatePerMeal: (mealIndex: number, updates: Partial<PerMealConstraints>) => void
  onAddMeal: () => void
  onRemoveMeal: (mealIndex: number) => void
}

// Available constraint types for per-meal
const PER_MEAL_CONSTRAINT_OPTIONS: { type: ConstraintType; label: string }[] = [
  { type: 'includeIngredients', label: 'Ingrédients à inclure' },
  { type: 'excludeIngredients', label: 'Ingrédients à exclure' },
  { type: 'dishType', label: 'Type de plat' },
  { type: 'dietaryRestrictions', label: 'Restrictions alimentaires' },
  { type: 'cuisineStyle', label: 'Style de cuisine' },
  { type: 'maxPrepTime', label: 'Temps de préparation max' },
  { type: 'maxCookTime', label: 'Temps de cuisson max' },
  { type: 'cookingMethod', label: 'Mode de cuisson' },
  { type: 'servings', label: 'Nombre de personnes' },
  { type: 'mealContext', label: 'Contexte du repas' }
]

export function ConstraintSection({
  constraints,
  onUpdateGeneral,
  onUpdatePerMeal,
  onAddMeal,
  onRemoveMeal
}: ConstraintSectionProps) {
  const { general, perMeal } = constraints

  const handleMealCountChange = (delta: number) => {
    const newCount = Math.max(1, Math.min(7, general.mealCount + delta))
    if (newCount !== general.mealCount) {
      onUpdateGeneral({ mealCount: newCount })
    }
  }

  // Helper to update specific constraint field in a meal
  const handleConstraintChange = (mealIndex: number, field: keyof PerMealConstraints, value: any) => {
    onUpdatePerMeal(mealIndex, { [field]: value })
  }

  // Helper to remove a constraint field from a meal (set to undefined)
  const handleRemoveConstraint = (mealIndex: number, field: keyof PerMealConstraints) => {
    onUpdatePerMeal(mealIndex, { [field]: undefined })
  }

  // Get active constraints for a meal (consider a constraint active if it exists, even if empty)
  const getActiveConstraints = (meal: PerMealConstraints): ConstraintType[] => {
    const active: ConstraintType[] = []
    if (meal.includeIngredients !== undefined) active.push('includeIngredients')
    if (meal.excludeIngredients !== undefined) active.push('excludeIngredients')
    if (meal.dishType !== undefined) active.push('dishType')
    if (meal.dietaryRestrictions !== undefined) active.push('dietaryRestrictions')
    if (meal.cuisineStyle !== undefined) active.push('cuisineStyle')
    if (meal.maxPrepTime !== undefined) active.push('maxPrepTime')
    if (meal.maxCookTime !== undefined) active.push('maxCookTime')
    if (meal.cookingMethod !== undefined) active.push('cookingMethod')
    if (meal.servings !== undefined) active.push('servings')
    if (meal.mealContext !== undefined) active.push('mealContext')
    return active
  }

  // Get available constraints for a meal (not yet active)
  const getAvailableConstraints = (meal: PerMealConstraints) => {
    const active = getActiveConstraints(meal)
    return PER_MEAL_CONSTRAINT_OPTIONS.filter(opt => !active.includes(opt.type))
  }

  return (
    <div className="space-y-6">
      {/* General Constraints Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Consignes générales</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meal Count Stepper */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nombre de repas</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMealCountChange(-1)}
                disabled={general.mealCount <= 1}
                className="h-8 w-8 p-0"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{general.mealCount}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMealCountChange(1)}
                disabled={general.mealCount >= 7}
                className="h-8 w-8 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Seasonal Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">De saison seulement</span>
            <Switch
              checked={general.seasonal ?? true}
              onCheckedChange={(checked) => onUpdateGeneral({ seasonal: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Separator between general and per-meal */}
      <Separator className="my-6" />

      {/* Per-Meal Constraints Sections */}
      <div className="space-y-6">
        {perMeal.map((meal, index) => (
          <React.Fragment key={index}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Utensils className="w-5 h-5" />
                    <span>Plat {index + 1}</span>
                  </CardTitle>
                  {perMeal.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMeal(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Render active constraints */}
                {getActiveConstraints(meal).map((constraintType) => (
                  <ConstraintCard
                    key={constraintType}
                    type={constraintType}
                    value={(meal as any)[constraintType]}
                    onChange={(value) => handleConstraintChange(index, constraintType as keyof PerMealConstraints, value)}
                    onRemove={() => handleRemoveConstraint(index, constraintType as keyof PerMealConstraints)}
                    showRemove
                  />
                ))}

                {/* Add constraint button */}
                {getAvailableConstraints(meal).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une consigne
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Sélectionner une consigne</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {getAvailableConstraints(meal).map((option) => (
                        <DropdownMenuItem
                          key={option.type}
                          onSelect={(e) => {
                            e.preventDefault()
                            // Initialize with appropriate default value
                            const defaultValue = 
                              option.type === 'includeIngredients' || option.type === 'excludeIngredients' ? [] :
                              option.type === 'dishType' || option.type === 'dietaryRestrictions' || 
                              option.type === 'cuisineStyle' || option.type === 'cookingMethod' || 
                              option.type === 'mealContext' ? [] :
                              option.type === 'maxPrepTime' || option.type === 'maxCookTime' ? 0 :
                              option.type === 'servings' ? 2 :
                              []
                            handleConstraintChange(index, option.type as keyof PerMealConstraints, defaultValue)
                          }}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Empty state when no constraints */}
                {getActiveConstraints(meal).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Aucune consigne pour ce plat. Cliquez sur "Ajouter une consigne" pour commencer.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Separator between meals (but not after the last one) */}
            {index < perMeal.length - 1 && (
              <Separator className="my-6" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Add Meal Button (only show if under the limit) */}
      {perMeal.length < general.mealCount && (
        <>
          <Separator className="my-6" />
          <Button
            variant="outline"
            className="w-full"
            onClick={onAddMeal}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un plat
          </Button>
        </>
      )}
    </div>
  )
}
