import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Clock, Users, Utensils, Leaf } from 'lucide-react'
import { ConstraintParseResponse } from '@/lib/assistant/types'

interface InterpretationSummaryProps {
  interpretation: ConstraintParseResponse
  onValidate: () => void
  onEdit: () => void
}

export function InterpretationSummary({ 
  interpretation, 
  onValidate, 
  onEdit 
}: InterpretationSummaryProps) {
  const { constraints, interpretation: text, confidence, extractedValues, language } = interpretation
  
  // Helper function to highlight extracted values in text
  const highlightExtractedValues = (text: string, values: Record<string, any>) => {
    let highlightedText = text
    
    // Highlight numbers (meal count, time)
    highlightedText = highlightedText.replace(/(\d+)/g, '<span class="font-semibold text-blue-600">$1</span>')
    
    // Highlight ingredients
    if (values.includeIngredients) {
      values.includeIngredients.forEach((ingredient: string) => {
        const regex = new RegExp(`(${ingredient})`, 'gi')
        highlightedText = highlightedText.replace(regex, '<span class="font-semibold text-green-600">$1</span>')
      })
    }
    
    // Highlight dietary restrictions
    if (values.dietaryRestrictions) {
      values.dietaryRestrictions.forEach((restriction: string) => {
        const regex = new RegExp(`(${restriction})`, 'gi')
        highlightedText = highlightedText.replace(regex, '<span class="font-semibold text-orange-600">$1</span>')
      })
    }
    
    // Highlight cuisine styles
    if (values.cuisineStyle) {
      values.cuisineStyle.forEach((cuisine: string) => {
        const regex = new RegExp(`(${cuisine})`, 'gi')
        highlightedText = highlightedText.replace(regex, '<span class="font-semibold text-purple-600">$1</span>')
      })
    }
    
    return highlightedText
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />
    return <AlertCircle className="w-4 h-4" />
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Consignes</h2>
        <p className="text-muted-foreground">Voilà ce que j'ai compris :</p>
      </div>

      {/* Interpretation Text card removed per request */}

      {/* Extracted Values Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* General Constraints */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Général</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nombre de repas</span>
              <Badge variant="secondary" className="text-xs">{constraints.general.mealCount}</Badge>
            </div>
            {constraints.general.seasonal && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center space-x-1">
                  <Leaf className="w-4 h-4" />
                  <span>De saison seulement</span>
                </span>
                <Badge variant="outline" className="text-green-600">Activé</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-Meal Constraints */}
        {constraints.perMeal.map((meal, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Utensils className="w-5 h-5" />
                <span>Plat {index + 1}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {meal.includeIngredients && meal.includeIngredients.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Ingrédients à inclure</span>
                  <div className="flex flex-wrap gap-1">
                    {meal.includeIngredients.map((ingredient, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                        {ingredient}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {meal.excludeIngredients && meal.excludeIngredients.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Ingrédients à exclure</span>
                  <div className="flex flex-wrap gap-1">
                    {meal.excludeIngredients.map((ingredient, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                        {ingredient}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {meal.dietaryRestrictions && meal.dietaryRestrictions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Restrictions alimentaires</span>
                  <div className="flex flex-wrap gap-1">
                    {meal.dietaryRestrictions.map((restriction, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {meal.cookingMethod && meal.cookingMethod.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Mode de cuisson</span>
                  <div className="flex flex-wrap gap-1">
                    {meal.cookingMethod.map((method, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                        {method}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {meal.cuisineStyle && meal.cuisineStyle.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Style de cuisine</span>
                  <div className="flex flex-wrap gap-1">
                    {meal.cuisineStyle.map((cuisine, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                        {cuisine}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {(meal.maxPrepTime || meal.maxCookTime) && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {meal.maxPrepTime && `Préparation: ${meal.maxPrepTime}min`}
                    {meal.maxPrepTime && meal.maxCookTime && ' • '}
                    {meal.maxCookTime && `Cuisson: ${meal.maxCookTime}min`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conflict Warnings */}
      {constraints.conflicts && constraints.conflicts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2 text-orange-800">
              <AlertCircle className="w-5 h-5" />
              <span>Conflits détectés</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {constraints.conflicts.map((conflict, index) => (
                <li key={index} className="text-sm text-orange-700">
                  • {conflict}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onEdit}>
          Corriger
        </Button>
        <Button onClick={onValidate}>
          Valider
        </Button>
      </div>
    </div>
  )
}
