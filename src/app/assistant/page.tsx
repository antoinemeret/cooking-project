'use client'

import { useAssistantStore, useAssistantState } from '@/lib/assistant/state'
import { Button } from '@/components/ui/button'
import { X, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AssistantRouteGuard, useAssistantNavigation } from '@/components/assistant/AssistantRouteGuard'
import { VoiceRecordButton } from '@/components/assistant/VoiceRecordButton'
import { RecipeSuggestionList } from '@/components/assistant/RecipeSuggestionList'
import { InterpretationSummary } from '@/components/assistant/InterpretationSummary'
import { ConstraintSection } from '@/components/assistant/ConstraintSection'
import { ConstraintParseResponse, PerMealConstraints, RecipeSuggestion } from '@/lib/assistant/types'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// Placeholder components for each step (to be implemented in later tasks)
function VoiceRecordingStep() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <h2 className="text-2xl font-semibold">Consigne</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Appuyez sur le bouton pour enregistrer vos consignes de repas
      </p>
      <VoiceRecordButton />
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Exemple: "Je veux 2 repas avec des légumes de saison, sans gluten"
      </p>
    </div>
  )
}

function InterpretationStep() {
  const interpretation = useAssistantStore(s => s.interpretation)
  const setInterpretation = useAssistantStore(s => s.setInterpretation)
  const setError = useAssistantStore(s => s.setError)
  const setLoading = useAssistantStore(s => s.setLoading)
  const transcriptionResult = useAssistantStore(s => s.transcriptionResult)
  const currentState = useAssistantState()
  const parsedRef = useRef(false)

  // Parse constraints when transcription result is available and we don't have interpretation yet
  useEffect(() => {
    console.log('[InterpretationStep] effect triggered', {
      hasTranscript: !!transcriptionResult,
      hasInterpretation: !!interpretation,
      parsedRef: parsedRef.current,
      currentState
    })
    
    // Don't parse if we already have an interpretation
    if (interpretation) {
      console.log('[InterpretationStep] Interpretation already exists, skipping parse')
      return
    }
    
    // Don't parse if we don't have a transcription result
    if (!transcriptionResult) {
      console.log('[InterpretationStep] No transcription result, skipping')
      return
    }
    
    // Don't parse if we've already initiated parsing
    if (parsedRef.current) {
      console.log('[InterpretationStep] Already parsed or parsing in progress, skipping')
      return
    }
    
    // Mark as parsing to prevent duplicate calls
    parsedRef.current = true
    console.log('[InterpretationStep] Starting parse with transcript:', transcriptionResult.transcript)
    
    const parseConstraints = async () => {
      try {
        setLoading(true)
        console.log('[InterpretationStep] parseConstraints:start')
        
        const response = await fetch('/api/constraints/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript: transcriptionResult.transcript,
            language: 'fr'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[InterpretationStep] API error response:', errorText)
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: ConstraintParseResponse = await response.json()
        console.log('[InterpretationStep] parseConstraints:success', result)
        
        // This will update the store and trigger a re-render
        setInterpretation(result)
        
        console.log('[InterpretationStep] setInterpretation completed, interpretation should now exist')
      } catch (error) {
        console.error('[InterpretationStep] parseConstraints:error', error)
        setError('Erreur lors de l\'interprétation des consignes. Veuillez réessayer.')
        setLoading(false)
        // Reset parsedRef on error so user can retry
        parsedRef.current = false
      }
    }
    
    parseConstraints()
  }, [transcriptionResult, interpretation, setInterpretation, setError, setLoading])

  const handleValidate = () => {
    // Move to suggestions for the first meal
    const store = useAssistantStore.getState()
    store.setCurrentMealIndex(0)
    store.setState('suggesting')
  }

  const handleEdit = () => {
    // Move to constraint editing step
    const store = useAssistantStore.getState()
    store.setState('editing')
  }

  // Show loading state while parsing
  const isLoading = useAssistantStore(s => s.isLoading)
  
  console.log('[InterpretationStep] Render', {
    hasInterpretation: !!interpretation,
    hasTranscript: !!transcriptionResult,
    isLoading,
    currentState,
    parsedRef: parsedRef.current
  })
  
  if (!interpretation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">
          {isLoading 
            ? 'Interprétation des consignes...' 
            : transcriptionResult 
              ? 'Traitement de la transcription...'
              : 'En attente de transcription...'}
        </p>
        {transcriptionResult && (
          <p className="text-xs text-muted-foreground">
            Transcript: {transcriptionResult.transcript.substring(0, 50)}...
          </p>
        )}
      </div>
    )
  }

  // Show interpretation summary when we have the interpretation
  console.log('[InterpretationStep] Rendering InterpretationSummary', { 
    interpretation: {
      confidence: interpretation.confidence,
      interpretation: interpretation.interpretation,
      constraints: interpretation.constraints
    }
  })
  
  return (
    <InterpretationSummary
      interpretation={interpretation}
      onValidate={handleValidate}
      onEdit={handleEdit}
    />
  )
}

function ConstraintEditingStep() {
  const { 
    constraints, 
    updateGeneralConstraints, 
    updatePerMealConstraints, 
    addPerMealConstraints,
    removePerMealConstraints,
    setState,
    setCurrentMealIndex,
    reset
  } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  if (!constraints) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Aucune consigne disponible</p>
      </div>
    )
  }

  const handleAddMeal = () => {
    const newMealIndex = constraints.perMeal.length
    const newMeal: PerMealConstraints = { mealIndex: newMealIndex }
    addPerMealConstraints(newMeal)
  }

  const handleContinue = () => {
    // Move to suggestions for the first meal
    setCurrentMealIndex(0)
    setState('suggesting')
  }

  const handleBack = () => {
    setState('interpreting')
  }

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-white flex gap-2 items-center justify-start pb-0 pt-2 px-3 relative shrink-0 w-full">
        <div className="basis-0 flex flex-col gap-1 grow items-start justify-center min-h-px min-w-px relative shrink-0">
          <div className="flex flex-col items-start justify-start relative shrink-0 w-full">
            <div className="h-7 relative shrink-0 w-full">
              <div className="absolute left-0 top-0 w-full">
                <span className="font-['Public_Sans:Regular',_sans-serif] font-normal text-[#b0b0b0] text-[18px] leading-[28px]">
                  Consignes{' '}
                </span>
                <ChevronRight className="inline size-5 mx-1 text-[#212b36]" />
                <span className="font-['Public_Sans:Bold',_sans-serif] font-bold text-[#212b36] text-[18px] leading-[28px]">
                  {' '}Modification
                </span>
              </div>
            </div>
          </div>
          <div className="font-['Public_Sans:Regular',_sans-serif] font-normal relative shrink-0 text-[#b3b3b3] text-[12px] leading-[18px]">
            Ajustez vos critères de sélection
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleClose}
          className="relative shrink-0 size-6 p-0"
        >
          <X className="size-6" />
        </Button>
      </div>
      
      <ConstraintSection
        constraints={constraints}
        onUpdateGeneral={updateGeneralConstraints}
        onUpdatePerMeal={updatePerMealConstraints}
        onAddMeal={handleAddMeal}
        onRemoveMeal={removePerMealConstraints}
      />
      
      <div className="flex gap-3 pt-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={handleBack}
        >
          Retour
        </Button>
        <Button 
          className="flex-1"
          onClick={handleContinue}
        >
          Continuer vers les suggestions
        </Button>
      </div>
    </div>
  )
}

function SuggestionsStep() {
  const { reset, constraints, selectRecipe, currentMealIndex, currentSuggestions, selectedRecipes } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const handleRecipeSelect = (recipe: RecipeSuggestion) => {
    selectRecipe(currentMealIndex, recipe)
  }

  const mealCount = constraints?.general?.mealCount || 2
  const selectedCount = selectedRecipes.length

  return (
    <div className="flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-white flex gap-2 items-center justify-start pb-0 pt-2 px-3 relative shrink-0 w-full">
        <div className="basis-0 flex flex-col gap-1 grow items-start justify-center min-h-px min-w-px relative shrink-0">
          <div className="flex flex-col items-start justify-start relative shrink-0 w-full">
            <div className="h-7 relative shrink-0 w-full">
              <div className="absolute left-0 top-0 w-full">
                <span className="font-['Public_Sans:Regular',_sans-serif] font-normal text-[#b0b0b0] text-[18px] leading-[28px]">
                  Consignes{' '}
                </span>
                <ChevronRight className="inline size-5 mx-1 text-[#212b36]" />
                <span className="font-['Public_Sans:Bold',_sans-serif] font-bold text-[#212b36] text-[18px] leading-[28px]">
                  {' '}Sélection
                </span>
              </div>
            </div>
          </div>
          <div className="font-['Public_Sans:Regular',_sans-serif] font-normal relative shrink-0 text-[#b3b3b3] text-[12px] leading-[18px]">
            {selectedCount}/{mealCount} Plats sélectionnés
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose} className="relative shrink-0 size-6 p-0">
          <X className="size-6" />
        </Button>
      </div>
      
      <RecipeSuggestionList
        mealIndex={currentMealIndex}
        onRecipeSelect={handleRecipeSelect}
      />
    </div>
  )
}

function ValidationStep() {
  const { reset, constraints, selectedRecipes, removeSelectedRecipe, setState } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(false)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const handleModifyConstraints = () => {
    setState('editing')
  }

  const handleValidate = async () => {
    if (selectedRecipes.length === 0) return
    
    setIsValidating(true)
    // Use 'user123' to match the planner page - TODO: Replace with actual user ID from auth
    const userId = 'user123'
    
    try {
      console.log(`[ValidationStep] Starting validation for ${selectedRecipes.length} recipes with userId: ${userId}`)
      
      // Add all recipes to planner
      const results = await Promise.allSettled(
        selectedRecipes.map(async (selection) => {
          const recipeId = parseInt(selection.recipe.id)
          if (isNaN(recipeId)) {
            throw new Error(`Invalid recipe ID: ${selection.recipe.id}`)
          }
          
          console.log(`[ValidationStep] Adding recipe ${recipeId} (${selection.recipe.name}) to planner for userId: ${userId}`)
          
          const response = await fetch('/api/planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipeId,
              userId
            })
          })
          
          const responseText = await response.text()
          console.log(`[ValidationStep] Response for recipe ${recipeId}:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseText
          })
          
          if (!response.ok) {
            let data
            try {
              data = JSON.parse(responseText)
            } catch {
              data = { error: responseText || 'Unknown error' }
            }
            
            // Don't fail on 409 (already in planner) - that's okay
            if (response.status !== 409) {
              const errorMsg = data.error || `Failed to add recipe ${selection.recipe.name} to planner (status: ${response.status})`
              const detailsMsg = data.details ? ` Details: ${data.details}` : ''
              console.error(`[ValidationStep] Failed to add recipe ${recipeId}:`, {
                status: response.status,
                error: errorMsg,
                details: data.details,
                fullData: data
              })
              throw new Error(`${errorMsg}${detailsMsg}`)
            } else {
              console.log(`[ValidationStep] Recipe ${recipeId} already in planner (409)`)
              return { success: true, alreadyExists: true, recipeId }
            }
          } else {
            const result = JSON.parse(responseText)
            console.log(`[ValidationStep] Successfully added recipe ${recipeId}:`, result)
            return { success: true, alreadyExists: false, recipeId, result }
          }
        })
      )
      
      // Log all results
      console.log('[ValidationStep] All results:', results)
      
      // Check if any requests failed (excluding 409 errors which we handle above)
      const failures = results.filter(
        result => result.status === 'rejected'
      )
      
      if (failures.length > 0) {
        const errorMessages = failures
          .map(f => {
            if (f.status === 'rejected') {
              return f.reason?.message || f.reason?.toString() || 'Unknown error'
            }
            return ''
          })
          .filter(Boolean)
        console.error('[ValidationStep] Some recipes failed to add:', errorMessages)
        throw new Error(`Failed to add some recipes: ${errorMessages.join(', ')}`)
      }
      
      const successes = results.filter(r => r.status === 'fulfilled')
      console.log(`[ValidationStep] Successfully processed ${successes.length}/${selectedRecipes.length} recipes`)
      
      // Set state to 'completed' first to prevent navigation guard from showing dialog
      // This will trigger the CompletedStep component which handles navigation and cleanup
      setState('completed')
      
      // Don't navigate here - let the CompletedStep handle it to avoid race conditions
    } catch (error) {
      console.error('[ValidationStep] Error validating selections:', error)
      setIsValidating(false)
      alert(error instanceof Error ? error.message : 'Erreur lors de l\'ajout des recettes au planning')
    }
  }

  const handleRemoveRecipe = (mealIndex: number) => {
    removeSelectedRecipe(mealIndex)
  }

  const handleImageError = (recipeId: string) => {
    setImageErrors(prev => ({ ...prev, [recipeId]: true }))
  }

  const mealCount = constraints?.general?.mealCount || 2
  const selectedCount = selectedRecipes.length

  // Sort selected recipes by mealIndex to display in order
  const sortedRecipes = [...selectedRecipes].sort((a, b) => a.mealIndex - b.mealIndex)

  return (
    <div className="flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-white flex gap-2 items-center justify-start pb-0 pt-2 px-3 relative shrink-0 w-full">
        <div className="basis-0 flex flex-col gap-1 grow items-start justify-center min-h-px min-w-px relative shrink-0">
          <div className="flex flex-col items-start justify-start relative shrink-0 w-full">
            <div className="h-7 relative shrink-0 w-full">
              <div className="absolute left-0 top-0 w-full">
                <span className="font-['Public_Sans:Regular',_sans-serif] font-normal text-[#b0b0b0] text-[18px] leading-[28px]">
                  Consignes{' '}
                </span>
                <ChevronRight className="inline size-5 mx-1 text-[#212b36]" />
                <span className="font-['Public_Sans:Bold',_sans-serif] font-bold text-[#212b36] text-[18px] leading-[28px]">
                  {' '}Sélection
                </span>
              </div>
            </div>
          </div>
          <div className="font-['Public_Sans:Regular',_sans-serif] font-normal relative shrink-0 text-[#b3b3b3] text-[12px] leading-[18px]">
            {selectedCount}/{mealCount} Plats sélectionnés
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose} className="relative shrink-0 size-6 p-0">
          <X className="size-6" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <h3 className="font-medium">Vos sélections</h3>
        {sortedRecipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune recette sélectionnée</p>
        ) : (
          sortedRecipes.map((selection) => {
            const recipe = selection.recipe
            const hasImageError = imageErrors[recipe.id] || false
            
            return (
              <div key={`${selection.mealIndex}-${recipe.id}`} className="border rounded-lg p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
                  {recipe.imageUrl && !hasImageError ? (
                    <Image
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      fill
                      className="object-cover"
                      onError={() => handleImageError(recipe.id)}
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
                <div className="flex-1">
                  <h4 className="font-medium">{recipe.name}</h4>
                  <p className="text-sm text-muted-foreground">Plat {selection.mealIndex + 1}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleRemoveRecipe(selection.mealIndex)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </Button>
              </div>
            )
          })
        )}
      </div>
      
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={handleModifyConstraints}
        >
          Modifier consignes
        </Button>
        <Button 
          className="flex-1"
          onClick={handleValidate}
          disabled={isValidating || selectedRecipes.length === 0}
        >
          {isValidating ? 'Validation...' : 'Valider'}
        </Button>
      </div>
    </div>
  )
}

function LoadingStep() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground">Traitement en cours...</p>
    </div>
  )
}

function ErrorStep() {
  const { setError } = useAssistantStore()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <X className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-red-600">Erreur</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Une erreur s'est produite. Veuillez réessayer.
      </p>
      <Button onClick={() => setError(null)}>
        Réessayer
      </Button>
    </div>
  )
}

function CompletedStep() {
  const router = useRouter()
  const { reset } = useAssistantStore()

  useEffect(() => {
    // Reset state first to clear the store
    reset()
    // Navigate to planner - the page will automatically fetch the latest data
    // Use window.location to force a full page reload and ensure data is fresh
    window.location.href = '/planner'
  }, [router, reset])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground">Redirection vers le planning...</p>
    </div>
  )
}

function AssistantPageContent() {
  const currentState = useAssistantState()
  const { reset, interpretation } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  // Reset state only when component unmounts
  // Use a ref to track the current state at unmount time
  const currentStateRef = useRef(currentState)
  useEffect(() => {
    currentStateRef.current = currentState
  }, [currentState])
  
  useEffect(() => {
    return () => {
      // Don't reset if we're navigating to planner after completion
      if (currentStateRef.current !== 'completed') {
        reset()
      }
    }
  }, [reset])

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const renderCurrentStep = () => {
    console.log('[AssistantPage] renderCurrentStep', { 
      currentState, 
      hasInterpretation: !!interpretation,
      interpretationKeys: interpretation ? Object.keys(interpretation) : null
    })
    switch (currentState) {
      case 'idle':
      case 'recording':
        return <VoiceRecordingStep />
      case 'processing':
      case 'interpreting':
        return <InterpretationStep />
      case 'editing':
        // Render constraint editing step when editing
        if (!interpretation) {
          console.warn('[AssistantPage] editing state without interpretation, falling back to InterpretationStep')
          return <InterpretationStep />
        }
        console.log('[AssistantPage] Rendering ConstraintEditingStep with interpretation')
        return <ConstraintEditingStep />
      case 'suggesting':
        return <SuggestionsStep />
      case 'validating':
        return <ValidationStep />
      case 'completed':
        return <CompletedStep />
      default:
        return <ErrorStep />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="container mx-auto px-4 pt-6 pb-36 max-w-2xl">
        {renderCurrentStep()}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <AssistantRouteGuard>
      <AssistantPageContent />
    </AssistantRouteGuard>
  )
} 