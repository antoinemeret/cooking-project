'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAssistantStore } from '@/lib/assistant/state'

interface AssistantRouteGuardProps {
  children: React.ReactNode
}

export function AssistantRouteGuard({ children }: AssistantRouteGuardProps) {
  const router = useRouter()
  const { currentState, reset, constraints, selectedRecipes } = useAssistantStore()
  const hasUnsavedProgress = useRef(false)

  // Track if user has made progress
  useEffect(() => {
    if (constraints || selectedRecipes.length > 0) {
      hasUnsavedProgress.current = true
    }
  }, [constraints, selectedRecipes])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedProgress.current && currentState !== 'completed') {
        event.preventDefault()
        event.returnValue = 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'
        return event.returnValue
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // If user navigates away from assistant and has unsaved progress
      if (hasUnsavedProgress.current && currentState !== 'completed') {
        const shouldLeave = window.confirm(
          'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'
        )
        
        if (!shouldLeave) {
          // Prevent navigation by pushing current state back
          window.history.pushState(null, '', window.location.href)
          return
        }
        
        // User confirmed leaving, reset state
        reset()
        hasUnsavedProgress.current = false
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [currentState, reset])

  // Handle programmatic navigation
  const handleNavigation = (path: string) => {
    if (hasUnsavedProgress.current && currentState !== 'completed') {
      const shouldLeave = window.confirm(
        'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'
      )
      
      if (!shouldLeave) {
        return false
      }
      
      // User confirmed leaving, reset state
      reset()
      hasUnsavedProgress.current = false
    }
    
    router.push(path)
    return true
  }

  // Provide navigation handler to children via context or props
  useEffect(() => {
    // Store navigation handler globally for use in components
    ;(window as any).assistantNavigation = handleNavigation
  }, [handleNavigation])

  return <>{children}</>
}

// Hook to use the navigation guard
export function useAssistantNavigation() {
  const router = useRouter()
  const { reset, currentState, constraints, selectedRecipes } = useAssistantStore()

  const hasUnsavedProgress = constraints || selectedRecipes.length > 0

  const navigateWithGuard = (path: string) => {
    if (hasUnsavedProgress && currentState !== 'completed') {
      const shouldLeave = window.confirm(
        'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'
      )
      
      if (!shouldLeave) {
        return false
      }
      
      // User confirmed leaving, reset state
      reset()
    }
    
    router.push(path)
    return true
  }

  return { navigateWithGuard, hasUnsavedProgress }
}
