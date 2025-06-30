'use client'

import { useState, useEffect, useRef } from "react"
import { MessageBubble, Message } from "./MessageBubble"
import { RecipeCard, RecipeSuggestion } from "./RecipeCard"
import { ChatInput } from "./ChatInput"
import { TypingIndicator } from "./TypingIndicator"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, Clock, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInterfaceProps {
  className?: string
}

interface SessionTimeoutInfo {
  isNearTimeout: boolean
  timeUntilTimeout: number
  timeUntilWarning: number
}

interface ChatSession {
  sessionId: string
  messages: Message[]
  suggestedRecipes: RecipeSuggestion[]
  isTyping: boolean
  error: string | null
  isResumed: boolean
  timeoutInfo?: SessionTimeoutInfo
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timeoutCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const userId = 'user123' // TODO: Replace with actual user ID

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [session?.messages, session?.isTyping])

  // Initialize chat session
  useEffect(() => {
    initializeSession()
    
    // Cleanup on unmount
    return () => {
      if (timeoutCheckInterval.current) {
        clearInterval(timeoutCheckInterval.current)
      }
    }
  }, [])

  // Check for stored session ID in localStorage
  const getStoredSessionId = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`chat_session_${userId}`)
    }
    return null
  }

  const storeSessionId = (sessionId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_session_${userId}`, sessionId)
    }
  }

  const clearStoredSessionId = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`chat_session_${userId}`)
    }
  }

  const initializeSession = async (forceNew = false) => {
    setIsInitializing(true)
    try {
      const storedSessionId = forceNew ? null : getStoredSessionId()
      
      const response = await fetch('/api/assistant/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          sessionId: storedSessionId,
          forceNew
        })
      })

      if (!response.ok) {
        throw new Error('Failed to initialize session')
      }

      const data = await response.json()
      
      // Store the session ID for future use
      storeSessionId(data.sessionId)
      
      setSession({
        sessionId: data.sessionId,
        messages: [{
          role: 'assistant',
          content: data.welcomeMessage,
          timestamp: new Date()
        }],
        suggestedRecipes: [],
        isTyping: false,
        error: null,
        isResumed: data.isResumed || false
      })

      // Start timeout monitoring
      startTimeoutMonitoring(data.sessionId)
      
    } catch (error) {
      console.error('Failed to initialize chat session:', error)
      setSession({
        sessionId: '',
        messages: [],
        suggestedRecipes: [],
        isTyping: false,
        error: 'Failed to start conversation. Please try again.',
        isResumed: false
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const startTimeoutMonitoring = (sessionId: string) => {
    // Clear existing interval
    if (timeoutCheckInterval.current) {
      clearInterval(timeoutCheckInterval.current)
    }

    // Check session timeout every 30 seconds
    timeoutCheckInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/assistant/chat?sessionId=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          const timeoutInfo = data.timeout

          setSession(prev => prev ? {
            ...prev,
            timeoutInfo
          } : null)

          // Show warning if near timeout
          setShowTimeoutWarning(timeoutInfo.isNearTimeout)
          
          // If session expired, clear stored session and reinitialize
          if (timeoutInfo.timeUntilTimeout <= 0) {
            clearStoredSessionId()
            clearInterval(timeoutCheckInterval.current!)
            setShowTimeoutWarning(false)
            await initializeSession(true) // Force new session
          }
        } else if (response.status === 404) {
          // Session not found, reinitialize
          clearStoredSessionId()
          clearInterval(timeoutCheckInterval.current!)
          await initializeSession(true)
        }
      } catch (error) {
        console.error('Error checking session timeout:', error)
      }
    }, 30000) // Check every 30 seconds
  }

  const sendMessage = async (userInput: string) => {
    if (!session) return

    // Add user message immediately
    const userMessage: Message = {
      role: 'user',
      content: userInput,
      timestamp: new Date()
    }

    setSession(prev => prev ? {
      ...prev,
      messages: [...prev.messages, userMessage],
      isTyping: true,
      error: null,
      suggestedRecipes: [] // Clear previous suggestions
    } : null)

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          userInput,
          userId,
          streaming: false // Use non-streaming for simplicity in MVP
        })
      })

      if (response.status === 404) {
        // Session expired, reinitialize and retry
        clearStoredSessionId()
        await initializeSession(true)
        // Retry the message after reinitializing
        return sendMessage(userInput)
      }

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMessage],
        suggestedRecipes: data.suggestedRecipes || [],
        isTyping: false
      } : null)

    } catch (error) {
      console.error('Failed to send message:', error)
      setSession(prev => prev ? {
        ...prev,
        isTyping: false,
        error: 'Failed to send message. Please try again.'
      } : null)
    }
  }

  const handleRecipeAccept = async (recipeId: number) => {
    if (!session) return

    try {
      const response = await fetch('/api/assistant/recipe-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          recipeId,
          action: 'accept',
          userId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to accept recipe')
      }

      const data = await response.json()
      
      // Add AI response about the acceptance
      const aiMessage: Message = {
        role: 'assistant',
        content: data.aiResponse,
        timestamp: new Date()
      }

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, aiMessage],
        suggestedRecipes: prev.suggestedRecipes.filter(s => s.recipe.id !== recipeId)
      } : null)

    } catch (error) {
      console.error('Failed to accept recipe:', error)
      setSession(prev => prev ? {
        ...prev,
        error: 'Failed to accept recipe. Please try again.'
      } : null)
    }
  }

  const handleRecipeDecline = async (recipeId: number, reason?: string) => {
    if (!session) return

    try {
      const response = await fetch('/api/assistant/recipe-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          recipeId,
          action: 'decline',
          reason,
          userId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to decline recipe')
      }

      const data = await response.json()
      
      // Add AI response about the decline
      const aiMessage: Message = {
        role: 'assistant',
        content: data.aiResponse,
        timestamp: new Date()
      }

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, aiMessage],
        // Remove the declined recipe and add new suggestions if any
        suggestedRecipes: [
          ...prev.suggestedRecipes.filter(s => s.recipe.id !== recipeId),
          ...(data.suggestedRecipes || [])
        ]
      } : null)

    } catch (error) {
      console.error('Failed to decline recipe:', error)
      setSession(prev => prev ? {
        ...prev,
        error: 'Failed to decline recipe. Please try again.'
      } : null)
    }
  }

  const resetConversation = () => {
    clearStoredSessionId()
    if (timeoutCheckInterval.current) {
      clearInterval(timeoutCheckInterval.current)
    }
    setShowTimeoutWarning(false)
    initializeSession(true)
  }

  const extendSession = async () => {
    if (!session) return
    
    try {
      // Send a simple message to extend the session
      await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          userInput: 'continue',
          userId,
          streaming: false
        })
      })
      
      setShowTimeoutWarning(false)
    } catch (error) {
      console.error('Failed to extend session:', error)
    }
  }

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }

  if (isInitializing) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Starting conversation...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Failed to start conversation</p>
          <Button onClick={() => initializeSession()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Session Timeout Warning */}
      {showTimeoutWarning && session.timeoutInfo && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Your session will expire in {formatTimeRemaining(session.timeoutInfo.timeUntilTimeout)}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={extendSession}
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            Continue Session
          </Button>
        </div>
      )}

      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b bg-background">
        <div className="min-w-0 flex-1 mr-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg md:text-xl font-semibold truncate">Recipe Assistant</h1>
            {session.isResumed && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                <RotateCcw className="h-3 w-3" />
                Resumed
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground hidden sm:block">
            Let me help you plan your meals! 🍳
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={resetConversation}
          disabled={session.isTyping}
          className="shrink-0 md:h-12 md:w-12"
        >
          <RefreshCw className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
        {/* Messages */}
        {session.messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {/* Recipe Suggestions */}
        {session.suggestedRecipes.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground px-2">
              Recipe Suggestions:
            </div>
            {session.suggestedRecipes.map((suggestion, index) => (
              <RecipeCard
                key={`${suggestion.recipe.id}-${index}`}
                suggestion={suggestion}
                onAccept={handleRecipeAccept}
                onDecline={handleRecipeDecline}
                disabled={session.isTyping}
              />
            ))}
          </div>
        )}

        {/* Typing Indicator */}
        {session.isTyping && <TypingIndicator />}

        {/* Error Message */}
        {session.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            {session.error}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={sendMessage}
        disabled={session.isTyping}
      />

      {/* Conversation Starters */}
      {session.messages.length === 1 && !session.isResumed && (
        <div className="p-3 sm:p-4 md:p-6 border-t bg-muted/30">
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-2 md:mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
            {[
              "I need 3 quick dinners for this week",
              "What vegetarian meals can I make?",
              "I have chicken and want something healthy",
              "Plan my meals for the weekend"
            ].map((starter, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm md:text-base h-8 md:h-10 px-2 sm:px-3 md:px-4"
                onClick={() => sendMessage(starter)}
                disabled={session.isTyping}
              >
                {starter}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 