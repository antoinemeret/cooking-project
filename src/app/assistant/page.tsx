'use client'

import { useAssistantStore, useAssistantState } from '@/lib/assistant/state'
import { Button } from '@/components/ui/button'
import { ArrowLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AssistantRouteGuard, useAssistantNavigation } from '@/components/assistant/AssistantRouteGuard'
import { VoiceRecordButton } from '@/components/assistant/VoiceRecordButton'

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
  return (
    <div className="flex flex-col space-y-6">
      <h2 className="text-2xl font-semibold">Consignes</h2>
      <div className="bg-muted p-4 rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Voilà ce que j'ai compris :</p>
        <p className="text-base">
          <span className="font-medium">2 repas</span> avec des 
          <span className="font-medium text-blue-600"> légumes de saison</span> et 
          <span className="font-medium text-green-600"> sans gluten</span>
        </p>
      </div>
      <div className="flex gap-3">
        <Button className="flex-1">Valider</Button>
        <Button variant="outline" className="flex-1">Corriger</Button>
      </div>
    </div>
  )
}

function ConstraintEditingStep() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Consignes</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Consignes générales</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Nombre de repas</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">-</Button>
                <span className="w-8 text-center">2</span>
                <Button variant="outline" size="sm">+</Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Plat 1</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Ingrédients à inclure</span>
              <Button variant="outline" size="sm">+ Ajouter</Button>
            </div>
          </div>
        </div>
      </div>
      
      <Button className="w-full">Continuer vers les suggestions</Button>
    </div>
  )
}

function SuggestionsStep() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Consignes > Sélection</h2>
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
          <h2 className="text-2xl font-semibold">Consignes > Sélection</h2>
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
  const { reset } = useAssistantStore()
  const { navigateWithGuard } = useAssistantNavigation()

  // Reset state when component unmounts
  useEffect(() => {
    return () => {
      // Only reset if we're not in a completed state
      if (currentState !== 'completed') {
        reset()
      }
    }
  }, [currentState, reset])

  const handleClose = () => {
    const shouldNavigate = navigateWithGuard('/planner')
    if (shouldNavigate) {
      reset()
    }
  }

  const renderCurrentStep = () => {
    switch (currentState) {
      case 'idle':
      case 'recording':
        return <VoiceRecordingStep />
      case 'processing':
      case 'interpreting':
        return <LoadingStep />
      case 'editing':
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
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
      <div className="container mx-auto px-4 py-6 max-w-2xl">
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