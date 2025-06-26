'use client'

import { useState, useEffect, useRef } from "react"
import { MessageBubble, Message } from "./MessageBubble"
import { RecipeCard, RecipeSuggestion } from "./RecipeCard"
import { ChatInput } from "./ChatInput"
import { TypingIndicator } from "./TypingIndicator"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInterfaceProps {
  className?: string
}

interface ChatSession {
  sessionId: string
  messages: Message[]
  suggestedRecipes: RecipeSuggestion[]
  isTyping: boolean
  error: string | null
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
  }, [])

  const initializeSession = async () => {
    setIsInitializing(true)
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        throw new Error('Failed to initialize session')
      }

      const data = await response.json()
      
      setSession({
        sessionId: data.sessionId,
        messages: [{
          role: 'assistant',
          content: data.welcomeMessage,
          timestamp: new Date()
        }],
        suggestedRecipes: [],
        isTyping: false,
        error: null
      })
    } catch (error) {
      console.error('Failed to initialize chat session:', error)
      setSession({
        sessionId: '',
        messages: [],
        suggestedRecipes: [],
        isTyping: false,
        error: 'Failed to start conversation. Please try again.'
      })
    } finally {
      setIsInitializing(false)
    }
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
        await initializeSession()
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
    initializeSession()
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
          <Button onClick={initializeSession}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div>
          <h1 className="text-lg font-semibold">Recipe Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Let me help you plan your meals! 🍳
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={resetConversation}
          disabled={session.isTyping}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
      {session.messages.length === 1 && (
        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
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
                className="text-xs h-8"
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