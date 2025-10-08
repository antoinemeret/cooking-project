'use client'

import { useAssistantStore, useAssistantState } from '@/lib/assistant/state'
import { Button } from '@/components/ui/button'
import { ArrowLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { AssistantRouteGuard, useAssistantNavigation } from '@/components/assistant/AssistantRouteGuard'
import { VoiceRecordButton } from '@/components/assistant/VoiceRecordButton'
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
    setCurrentMealIndex
  } = useAssistantStore()

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

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Modifier les consignes</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
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
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Consignes {'>'} Sélection</h2>
          <p className="text-muted-foreground">0/2 Plats sélectionnés</p>
        </div>
        <Button variant="ghost" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-3">Correspond à toutes les consignes</h3>
          <div className="grid gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="border rounded-lg p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium">Recette {i}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>⏱️ 15 min</span>
                    <span>👥 4 pers</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">👁️</Button>
                  <Button size="sm">📅</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ValidationStep() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Consignes {'>'} Sélection</h2>
          <p className="text-muted-foreground">2/2 Plats sélectionnés</p>
        </div>
        <Button variant="ghost" size="sm">
          <X className="w-4 h-4" />
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
      {/* Header */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClose}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au planning
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

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