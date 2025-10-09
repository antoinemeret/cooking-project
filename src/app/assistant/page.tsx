'use client'

import { useAssistantStore, useAssistantState } from '@/lib/assistant/state'
import { Button } from '@/components/ui/button'
import { ArrowLeft, X, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { AssistantRouteGuard, useAssistantNavigation } from '@/components/assistant/AssistantRouteGuard'
import { VoiceRecordButton } from '@/components/assistant/VoiceRecordButton'
import { RecipeSuggestionList } from '@/components/assistant/RecipeSuggestionList'
import { InterpretationSummary } from '@/components/assistant/InterpretationSummary'
import { ConstraintSection } from '@/components/assistant/ConstraintSection'
import { ConstraintParseResponse, PerMealConstraints } from '@/lib/assistant/types'

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

  // Parse constraints when component mounts
  useEffect(() => {
    console.log('[InterpretationStep] mount/effect', {
      currentState,
      hasTranscript: !!transcriptionResult,
      hasInterpretation: !!interpretation,
      parsedRef: parsedRef.current
    })
    if (!transcriptionResult) return
    if (interpretation) return
    if (parsedRef.current) return
    parsedRef.current = true
    console.log('[InterpretationStep] triggering parse with transcript:', transcriptionResult.transcript)
    parseConstraints(transcriptionResult.transcript)
  }, [transcriptionResult, interpretation, currentState])

  const parseConstraints = async (transcript: string) => {
    try {
      setLoading(true)
      console.log('[InterpretationStep] parseConstraints:start')
      
      const response = await fetch('/api/constraints/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          language: 'fr'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ConstraintParseResponse = await response.json()
      console.log('[InterpretationStep] parseConstraints:success', result)
      // Ensure state flip even under Strict Mode by calling the store directly
      const store = useAssistantStore.getState()
      if (store.setInterpretation) store.setInterpretation(result)
      if (store.setState) store.setState('editing')
    } catch (error) {
      console.error('[InterpretationStep] parseConstraints:error', error)
      setError('Erreur lors de l\'interprétation des consignes. Veuillez réessayer.')
    } finally {
      setLoading(false)
      console.log('[InterpretationStep] parseConstraints:done')
    }
  }

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

  if (!interpretation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Interprétation des consignes... ({currentState})</p>
      </div>
    )
  }

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
  const { reset, constraints, selectRecipe, currentMealIndex } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const mealCount = constraints?.general?.mealCount || 2
  const selectedCount = 0 // TODO: Get actual selected count from state

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
        onRecipeSelect={(recipeId) => {
          selectRecipe(currentMealIndex, { id: recipeId } as any)
        }}
      />
    </div>
  )
}

function ValidationStep() {
  const { reset, constraints, selectedRecipes } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
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
      
      <div className="space-y-3">
        <h3 className="font-medium">Vos sélections</h3>
        {[1, 2].map(i => (
          <div key={i} className="border rounded-lg p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium">Recette {i}</h4>
              <p className="text-sm text-muted-foreground">Plat {i}</p>
            </div>
            <Button variant="ghost" size="sm">✕</Button>
          </div>
        ))}
      </div>
      
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1">Modifier consignes</Button>
        <Button className="flex-1">Valider</Button>
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

function AssistantPageContent() {
  const currentState = useAssistantState()
  const { reset, interpretation } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  // Reset state only when component unmounts
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const renderCurrentStep = () => {
    console.log('[AssistantPage] renderCurrentStep', { currentState, hasInterpretation: !!interpretation })
    switch (currentState) {
      case 'idle':
      case 'recording':
        return <VoiceRecordingStep />
      case 'processing':
      case 'interpreting':
        return <InterpretationStep />
      case 'editing':
        // Render the summary directly when editing
        if (!interpretation) {
          console.warn('[AssistantPage] editing state without interpretation, falling back to InterpretationStep')
          return <InterpretationStep />
        }
        return <ConstraintEditingStep />
      case 'suggesting':
        return <SuggestionsStep />
      case 'validating':
        return <ValidationStep />
      case 'completed':
        // Redirect to planner after completion
        navigateWithGuard('/planner')
        return null
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