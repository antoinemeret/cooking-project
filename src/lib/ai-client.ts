import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { PerformanceMonitor } from './performance-utils'

// Claude Sonnet 4 model configuration
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'

// Error handling configuration
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay
const TIMEOUT_MS = 30000 // 30 second timeout

export interface AIServiceError {
  type: 'rate_limit' | 'service_unavailable' | 'timeout' | 'invalid_response' | 'network_error' | 'unknown'
  message: string
  retryable: boolean
  retryAfter?: number
}

/**
 * Custom error class for AI service failures
 */
export class AIServiceException extends Error {
  public readonly serviceError: AIServiceError

  constructor(serviceError: AIServiceError) {
    super(serviceError.message)
    this.name = 'AIServiceException'
    this.serviceError = serviceError
  }
}

/**
 * Fallback responses for when AI service is unavailable
 */
const FALLBACK_RESPONSES = {
  greeting: "Hello! I'm here to help you plan your meals, but I'm experiencing some technical difficulties right now. You can still browse your recipes and use the planner manually. I'll be back to full functionality soon!",
  
  recipe_request: "I'd love to help you find recipes, but I'm having trouble connecting to my recommendation engine right now. In the meantime, you can browse your recipe collection directly or check out your previously planned meals in the Planner tab.",
  
  general_error: "I'm experiencing some technical difficulties at the moment. You can still use the recipe browser and meal planner while I get back online. Please try again in a few minutes!",
  
  timeout: "I'm taking longer than usual to respond. This might be due to high demand. You can continue using the app manually, or try asking me again in a moment.",
  
  maintenance: "I'm currently undergoing maintenance to improve my recipe suggestions. All other features are still available. I should be back to helping with meal planning shortly!"
}

/**
 * Determine error type from exception
 */
function classifyError(error: any): AIServiceError {
  const message = error.message?.toLowerCase() || ''
  
  // Rate limiting errors
  if (error.status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    const retryAfter = error.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) * 1000 : 60000
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded. Please wait before trying again.',
      retryable: true,
      retryAfter
    }
  }
  
  // Service unavailable
  if (error.status >= 500 || message.includes('service unavailable') || message.includes('internal server error')) {
    return {
      type: 'service_unavailable',
      message: 'AI service is temporarily unavailable.',
      retryable: true
    }
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('aborted') || error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out. The service may be experiencing high load.',
      retryable: true
    }
  }
  
  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return {
      type: 'network_error',
      message: 'Network connection error. Please check your internet connection.',
      retryable: true
    }
  }
  
  // Invalid response
  if (error.status === 400 || message.includes('invalid') || message.includes('bad request')) {
    return {
      type: 'invalid_response',
      message: 'Invalid request format.',
      retryable: false
    }
  }
  
  // Unknown error
  return {
    type: 'unknown',
    message: error.message || 'An unexpected error occurred.',
    retryable: true
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateRetryDelay(attempt: number, baseDelay: number = RETRY_DELAY_BASE): number {
  return baseDelay * Math.pow(2, attempt) + Math.random() * 1000 // Add jitter
}

/**
 * Initialize Claude Sonnet 4 client with optimal settings for recipe conversations
 */
export function createClaudeClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  return new ChatAnthropic({
    model: CLAUDE_MODEL,
    temperature: 0.7, // Balanced creativity for recipe suggestions
    maxTokens: 4000, // Sufficient for detailed recipe conversations
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    streaming: true, // Enable streaming for real-time responses
  })
}

/**
 * System prompt for the conversational recipe assistant
 */
export const RECIPE_ASSISTANT_SYSTEM_PROMPT = `You are a helpful conversational recipe planning assistant. Your role is to help users plan their meals by suggesting recipes from their personal collection based on their preferences and needs.

## Your Capabilities:
- Suggest recipes from the user's saved collection based on their criteria
- Filter recipes by dietary restrictions, seasonality, cooking time, and ingredients
- Ask clarifying questions when user requests are unclear
- Present recipe suggestions in a conversational, friendly manner
- Help users build weekly meal plans

## Important Guidelines:
1. **Only suggest recipes from the user's collection** - never recommend recipes they don't have saved
2. **Ask clarifying questions** when requests are vague (e.g., "How many meals?", "Any dietary restrictions?")
3. **Consider seasonality** - prefer in-season recipes when possible
4. **Be conversational** - respond naturally, not like a formal system
5. **Present one recipe at a time** for user feedback rather than overwhelming them
6. **Respect dietary restrictions** strictly - never suggest recipes that violate stated restrictions

## Recipe Filtering Criteria:
- **Dietary**: vegetarian, vegan, gluten-free, dairy-free, nut-free
- **Meal Types**: breakfast, lunch, dinner, dessert, snack
- **Cooking Methods**: quick & easy, baked, grilled, slow-cooked
- **Cuisines**: italian, asian, mexican, mediterranean
- **Seasonality**: based on current month and recipe season data
- **Ingredients**: required ingredients to use up, or ingredients to avoid

## Response Format:
When suggesting a recipe, present it as a conversational recommendation with:
- Recipe title and brief description
- Why it matches their criteria
- Ask if they'd like to accept it or see alternatives

Example: "I found a great option for you! How about **Tomato Basil Pasta**? It's a quick Italian dish that's perfect for this season since tomatoes are at their peak. It takes just 30 minutes and has that fresh Mediterranean flavor you mentioned. Would you like to add this to your meal plan, or shall I suggest something different?"

Remember: You're having a natural conversation about meal planning, not just listing recipes!`

/**
 * Create a chat prompt template for recipe conversations
 */
export function createRecipeConversationPrompt() {
  return ChatPromptTemplate.fromMessages([
    ['system', RECIPE_ASSISTANT_SYSTEM_PROMPT],
    new MessagesPlaceholder('conversation_history'),
    ['human', '{user_input}'],
  ])
}

/**
 * Format conversation history for the AI
 */
export function formatConversationHistory(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return messages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content)
    } else {
      return new AIMessage(msg.content)
    }
  })
}

/**
 * Format recipe data for AI context
 */
export function formatRecipesForAI(recipes: Array<{
  id: number
  title: string
  summary: string
  tags: string
  startSeason: number
  endSeason: number
  time: number
  grade: number
}>) {
  if (recipes.length === 0) {
    return "No recipes available in the user's collection."
  }

  return `Available recipes in user's collection (${recipes.length} total):

${recipes.map(recipe => {
  let tags: string[] = []
  try {
    tags = JSON.parse(recipe.tags)
  } catch {
    tags = []
  }

  const seasonText = recipe.startSeason === recipe.endSeason 
    ? `Month ${recipe.startSeason}` 
    : recipe.startSeason <= recipe.endSeason
    ? `Months ${recipe.startSeason}-${recipe.endSeason}`
    : `Months ${recipe.startSeason}-12, 1-${recipe.endSeason}`

  return `- **${recipe.title}**: ${recipe.summary}
  Tags: ${tags.length > 0 ? tags.join(', ') : 'none'}
  Season: ${seasonText} | Time: ${recipe.time}min | Rating: ${recipe.grade}/3 stars`
}).join('\n\n')}`
}

/**
 * Generate fallback response based on user input
 */
function generateFallbackResponse(userInput: string): string {
  const input = userInput.toLowerCase()
  
  // Check for greeting patterns
  if (input.includes('hello') || input.includes('hi') || input.includes('hey') || input.length < 10) {
    return FALLBACK_RESPONSES.greeting
  }
  
  // Check for recipe request patterns
  if (input.includes('recipe') || input.includes('meal') || input.includes('cook') || 
      input.includes('dinner') || input.includes('lunch') || input.includes('breakfast') ||
      input.includes('suggest') || input.includes('recommend')) {
    return FALLBACK_RESPONSES.recipe_request
  }
  
  // Default fallback
  return FALLBACK_RESPONSES.general_error
}

/**
 * AI client interface for recipe conversations with enhanced error handling
 */
export class RecipeAssistantAI {
  private client: ChatAnthropic
  private prompt: ChatPromptTemplate
  private isServiceHealthy: boolean = true
  private lastHealthCheck: Date = new Date()

  constructor() {
    this.client = createClaudeClient()
    this.prompt = createRecipeConversationPrompt()
  }

  /**
   * Check service health status
   */
  private async checkServiceHealth(): Promise<boolean> {
    // Only check health every 5 minutes
    const now = new Date()
    if (now.getTime() - this.lastHealthCheck.getTime() < 5 * 60 * 1000 && this.isServiceHealthy) {
      return this.isServiceHealthy
    }

    try {
      // Simple health check with minimal request
      const testResponse = await this.client.invoke([
        new SystemMessage("Respond with just 'OK' to confirm service availability."),
        new HumanMessage("Health check")
      ])
      
      this.isServiceHealthy = true
      this.lastHealthCheck = now
      return true
    } catch (error) {
      this.isServiceHealthy = false
      this.lastHealthCheck = now
      return false
    }
  }

  /**
   * Execute AI request with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'AI request'
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
        })
        
        const result = await Promise.race([operation(), timeoutPromise])
        
        // Reset health status on success
        this.isServiceHealthy = true
        return result
        
      } catch (error) {
        lastError = error
        const classifiedError = classifyError(error)
        
        console.error(`${context} attempt ${attempt + 1} failed:`, {
          type: classifiedError.type,
          message: classifiedError.message,
          retryable: classifiedError.retryable
        })
        
        // Don't retry non-retryable errors
        if (!classifiedError.retryable) {
          throw new AIServiceException(classifiedError)
        }
        
        // Don't retry on last attempt
        if (attempt === MAX_RETRY_ATTEMPTS - 1) {
          break
        }
        
        // Wait before retrying
        const delay = classifiedError.retryAfter || calculateRetryDelay(attempt)
        await sleep(delay)
      }
    }
    
    // All retries failed
    const finalError = classifyError(lastError)
    this.isServiceHealthy = false
    throw new AIServiceException(finalError)
  }

  /**
   * Generate a response for recipe conversation with error handling
   */
  async generateResponse(
    userInput: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    availableRecipes: Array<{
      id: number
      title: string
      summary: string
      tags: string
      startSeason: number
      endSeason: number
      time: number
      grade: number
    }>,
    currentMonth?: number
  ): Promise<{ response: string; usedFallback: boolean; error?: AIServiceError }> {
    
    const performanceMonitor = PerformanceMonitor.getInstance()
    const endTimer = performanceMonitor.startTimer('ai-response-generation')
    
    try {
      // Check service health first
      const isHealthy = await this.checkServiceHealth()
      if (!isHealthy) {
        endTimer()
        performanceMonitor.recordMetric('ai-response-fallback', 1)
        return {
          response: generateFallbackResponse(userInput),
          usedFallback: true,
          error: {
            type: 'service_unavailable',
            message: 'AI service is currently unavailable',
            retryable: true
          }
        }
      }

      const response = await this.executeWithRetry(async () => {
        const recipesContext = formatRecipesForAI(availableRecipes)
        const currentDate = new Date()
        const month = currentMonth || (currentDate.getMonth() + 1)
        
        const contextualInput = `Current context:
- Current month: ${month} (${new Date(2024, month - 1).toLocaleString('default', { month: 'long' })})
- User's recipe collection: ${availableRecipes.length} recipes

${recipesContext}

User request: ${userInput}`

        const formattedHistory = formatConversationHistory(conversationHistory)
        const chain = this.prompt.pipe(this.client)

        const result = await chain.invoke({
          conversation_history: formattedHistory,
          user_input: contextualInput,
        })

        return result.content as string
      }, 'Generate response')

      endTimer()
      performanceMonitor.recordMetric('ai-response-success', 1)
      return { response, usedFallback: false }

    } catch (error) {
      endTimer()
      performanceMonitor.recordMetric('ai-response-error', 1)
      
      if (error instanceof AIServiceException) {
        console.error('AI service error:', error.serviceError)
        
        return {
          response: generateFallbackResponse(userInput),
          usedFallback: true,
          error: error.serviceError
        }
      }
      
      // Unexpected error
      console.error('Unexpected error in generateResponse:', error)
      return {
        response: FALLBACK_RESPONSES.general_error,
        usedFallback: true,
        error: {
          type: 'unknown',
          message: 'An unexpected error occurred',
          retryable: true
        }
      }
    }
  }

  /**
   * Generate streaming response with error handling
   */
  async *generateStreamingResponse(
    userInput: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    availableRecipes: Array<{
      id: number
      title: string
      summary: string
      tags: string
      startSeason: number
      endSeason: number
      time: number
      grade: number
    }>,
    currentMonth?: number
  ): AsyncGenerator<{ content: string; usedFallback?: boolean; error?: AIServiceError }> {
    
    try {
      // Check service health first
      const isHealthy = await this.checkServiceHealth()
      if (!isHealthy) {
        yield {
          content: generateFallbackResponse(userInput),
          usedFallback: true,
          error: {
            type: 'service_unavailable',
            message: 'AI service is currently unavailable',
            retryable: true
          }
        }
        return
      }

      const recipesContext = formatRecipesForAI(availableRecipes)
      const currentDate = new Date()
      const month = currentMonth || (currentDate.getMonth() + 1)
      
      const contextualInput = `Current context:
- Current month: ${month} (${new Date(2024, month - 1).toLocaleString('default', { month: 'long' })})
- User's recipe collection: ${availableRecipes.length} recipes

${recipesContext}

User request: ${userInput}`

      const formattedHistory = formatConversationHistory(conversationHistory)
      const chain = this.prompt.pipe(this.client)

      const stream = await this.executeWithRetry(async () => {
        return chain.stream({
          conversation_history: formattedHistory,
          user_input: contextualInput,
        })
      }, 'Generate streaming response')

      for await (const chunk of stream) {
        if (chunk.content) {
          yield { content: chunk.content as string }
        }
      }

    } catch (error) {
      if (error instanceof AIServiceException) {
        console.error('AI service error in streaming:', error.serviceError)
        
        yield {
          content: generateFallbackResponse(userInput),
          usedFallback: true,
          error: error.serviceError
        }
      } else {
        console.error('Unexpected error in generateStreamingResponse:', error)
        yield {
          content: FALLBACK_RESPONSES.general_error,
          usedFallback: true,
          error: {
            type: 'unknown',
            message: 'An unexpected error occurred',
            retryable: true
          }
        }
      }
    }
  }

  /**
   * Get current service status
   */
  async getServiceStatus(): Promise<{
    healthy: boolean
    lastCheck: Date
    message: string
  }> {
    const isHealthy = await this.checkServiceHealth()
    
    return {
      healthy: isHealthy,
      lastCheck: this.lastHealthCheck,
      message: isHealthy 
        ? 'AI service is operating normally'
        : 'AI service is experiencing issues. Fallback responses are active.'
    }
  }

  /**
   * Force a service health check
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastHealthCheck = new Date(0) // Force recheck
    return this.checkServiceHealth()
  }
}

// Export singleton instance
export const recipeAssistantAI = new RecipeAssistantAI()

/**
 * Generate user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: AIServiceError): string {
  switch (error.type) {
    case 'rate_limit':
      return "I'm getting a lot of requests right now. Please wait a moment before trying again."
    
    case 'service_unavailable':
      return "I'm temporarily unavailable for maintenance. You can still browse recipes and use the planner manually."
    
    case 'timeout':
      return "I'm taking longer than usual to respond due to high demand. You can continue using the app while I catch up."
    
    case 'network_error':
      return "There seems to be a connection issue. Please check your internet connection and try again."
    
    case 'invalid_response':
      return "I'm having trouble understanding that request. Could you try rephrasing it?"
    
    default:
      return "I'm experiencing some technical difficulties. All other app features are still working normally."
  }
}

/**
 * Generate conversation reset suggestions based on user's recipe collection size
 */
export async function generateManualResetSuggestions(): Promise<string[]> {
  try {
    // Simple fallback suggestions when AI is unavailable
    return [
      "Browse your recipe collection in the Recipes tab",
      "Check your current meal plan in the Planner",
      "View your grocery list if you have planned meals",
      "Try asking me again in a few minutes"
    ]
  } catch (error) {
    return [
      "Browse your recipes manually",
      "Use the meal planner directly",
      "Try again later"
    ]
  }
} 