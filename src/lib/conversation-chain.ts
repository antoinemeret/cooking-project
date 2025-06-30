import { RecipeAssistantAI } from './ai-client'
import { filterRecipes } from './recipe-filters'
import { PrismaClient, Recipe } from '@prisma/client'
import { globalSessionStore } from './session-store'

const prisma = new PrismaClient()

// Types for conversation state
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface RecipeAction {
  recipeId: number
  action: 'accept' | 'decline'
  timestamp: Date
  reason?: string
  undone?: boolean
}

export interface MealPlanningSession {
  id: string
  userId: string
  messages: ConversationMessage[]
  acceptedRecipes: number[] // Recipe IDs that user accepted
  declinedRecipes: number[] // Recipe IDs that user declined
  recipeActions: RecipeAction[] // Full history of actions for undo functionality
  currentCriteria: RecipeFilterCriteria
  createdAt: Date
  updatedAt: Date
}

export interface RecipeFilterCriteria {
  dietaryRestrictions?: string[]
  mealTypes?: string[]
  cookingMethods?: string[]
  cuisines?: string[]
  requiredIngredients?: string[]
  excludedIngredients?: string[]
  maxCookingTime?: number
  seasonality?: boolean
  excludeAccepted?: boolean
  excludeDeclined?: boolean
}

export interface RecipeRecommendation {
  recipe: Recipe
  reason: string
  confidence: number
}

/**
 * Conversation chain for meal planning with recipe filtering
 */
export class MealPlanningConversationChain {
  private ai: RecipeAssistantAI

  constructor() {
    this.ai = new RecipeAssistantAI()
  }

  /**
   * Start a new meal planning conversation
   */
  async startConversation(userId: string): Promise<string> {
    const sessionId = `session_${userId}_${Date.now()}`
    
    const session: MealPlanningSession = {
      id: sessionId,
      userId,
      messages: [],
      acceptedRecipes: [],
      declinedRecipes: [],
      recipeActions: [],
      currentCriteria: {
        seasonality: true, // Default to seasonal filtering
        excludeAccepted: true,
        excludeDeclined: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Use enhanced session creation
    globalSessionStore.createSession(sessionId, session)

    // Welcome message
    const welcomeMessage = await this.generateWelcomeMessage(userId)
    this.addMessage(sessionId, 'assistant', welcomeMessage)

    return sessionId
  }

  /**
   * Resume an existing conversation or start a new one
   */
  async resumeOrStartConversation(userId: string, preferredSessionId?: string): Promise<{
    sessionId: string
    isResumed: boolean
    welcomeMessage: string
  }> {
    // Try to use preferred session if provided and valid
    if (preferredSessionId && globalSessionStore.isSessionValid(preferredSessionId)) {
      const session = globalSessionStore.getSession(preferredSessionId)
      if (session && session.userId === userId) {
        return {
          sessionId: preferredSessionId,
          isResumed: true,
          welcomeMessage: "Welcome back! Let's continue planning your meals. 🍳"
        }
      }
    }

    // Try to find the most recent active session for the user
    const recentSessionId = globalSessionStore.getMostRecentUserSession(userId)
    if (recentSessionId) {
      const session = globalSessionStore.getSession(recentSessionId)
      if (session) {
        const metadata = globalSessionStore.getSessionMetadata(recentSessionId)
        const resumeMessage = `Welcome back! I found your previous conversation from ${
          metadata?.lastActivity.toLocaleDateString()
        }. Would you like to continue where we left off, or start fresh?`
        
        return {
          sessionId: recentSessionId,
          isResumed: true,
          welcomeMessage: resumeMessage
        }
      }
    }

    // Start a new conversation
    const newSessionId = await this.startConversation(userId)
    const session = globalSessionStore.getSession(newSessionId)
    const welcomeMessage = session?.messages[0]?.content || 'Welcome! How can I help you plan your meals?'

    return {
      sessionId: newSessionId,
      isResumed: false,
      welcomeMessage
    }
  }

  /**
   * Process user input and generate AI response
   */
  async processUserInput(
    sessionId: string,
    userInput: string
  ): Promise<{ response: string; suggestedRecipes?: RecipeRecommendation[] }> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Add user message to conversation
    this.addMessage(sessionId, 'user', userInput)

    // Extract criteria from user input
    const extractedCriteria = await this.extractCriteriaFromInput(userInput, session.currentCriteria)
    session.currentCriteria = { ...session.currentCriteria, ...extractedCriteria }

    // Get filtered recipes based on current criteria
    const availableRecipes = await this.getFilteredRecipes(session)

    // Generate AI response with recipe context
    const response = await this.ai.generateResponse(
      userInput,
      session.messages.slice(0, -1), // Exclude the just-added user message
      availableRecipes.map(this.formatRecipeForAI),
      new Date().getMonth() + 1
    )

    // Add AI response to conversation
    this.addMessage(sessionId, 'assistant', response)

    // Extract recipe suggestions from response if any
    const suggestedRecipes = this.extractRecipeSuggestions(response, availableRecipes)

    session.updatedAt = new Date()
    globalSessionStore.setSession(sessionId, session) // Update the session

    return {
      response,
      suggestedRecipes: suggestedRecipes.length > 0 ? suggestedRecipes : undefined
    }
  }

  /**
   * Process streaming user input for real-time responses
   */
  async *processUserInputStreaming(
    sessionId: string,
    userInput: string
  ): AsyncGenerator<string, void, unknown> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Add user message to conversation
    this.addMessage(sessionId, 'user', userInput)

    // Extract criteria and get filtered recipes
    const extractedCriteria = await this.extractCriteriaFromInput(userInput, session.currentCriteria)
    session.currentCriteria = { ...session.currentCriteria, ...extractedCriteria }

    const availableRecipes = await this.getFilteredRecipes(session)

    // Generate streaming response
    let fullResponse = ''
    const responseGenerator = this.ai.generateStreamingResponse(
      userInput,
      session.messages.slice(0, -1),
      availableRecipes.map(this.formatRecipeForAI),
      new Date().getMonth() + 1
    )

    for await (const chunk of responseGenerator) {
      fullResponse += chunk
      yield chunk
    }

    // Add complete response to conversation
    this.addMessage(sessionId, 'assistant', fullResponse)
    session.updatedAt = new Date()
    globalSessionStore.setSession(sessionId, session) // Update the session
  }

  /**
   * Accept a recipe suggestion
   */
  async acceptRecipe(sessionId: string, recipeId: number): Promise<string> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Record the action
    const action: RecipeAction = {
      recipeId,
      action: 'accept',
      timestamp: new Date()
    }
    session.recipeActions.push(action)

    if (!session.acceptedRecipes.includes(recipeId)) {
      session.acceptedRecipes.push(recipeId)
    }

    // Remove from declined if it was there
    session.declinedRecipes = session.declinedRecipes.filter((id: number) => id !== recipeId)

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
    const confirmationMessage = `Great choice! I've added **${recipe?.title}** to your meal plan. Would you like me to suggest another recipe or help you with something else?`

    this.addMessage(sessionId, 'assistant', confirmationMessage)
    session.updatedAt = new Date()
    globalSessionStore.setSession(sessionId, session)

    return confirmationMessage
  }

  /**
   * Decline a recipe suggestion
   */
  async declineRecipe(sessionId: string, recipeId: number, reason?: string): Promise<string> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Record the action
    const action: RecipeAction = {
      recipeId,
      action: 'decline',
      timestamp: new Date(),
      reason
    }
    session.recipeActions.push(action)

    if (!session.declinedRecipes.includes(recipeId)) {
      session.declinedRecipes.push(recipeId)
    }

    // Remove from accepted if it was there
    session.acceptedRecipes = session.acceptedRecipes.filter((id: number) => id !== recipeId)

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
    let responseMessage = `No problem! I'll skip **${recipe?.title}**.`

    if (reason) {
      responseMessage += ` Thanks for letting me know ${reason}.`
    }

    responseMessage += ` Let me suggest something else that might work better for you.`

    this.addMessage(sessionId, 'assistant', responseMessage)
    session.updatedAt = new Date()
    globalSessionStore.setSession(sessionId, session)

    return responseMessage
  }

  /**
   * Undo the last recipe action
   */
  async undoLastAction(sessionId: string): Promise<{ success: boolean; message: string; undoneAction?: RecipeAction }> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Find the last non-undone action
    const lastActionIndex = session.recipeActions.findLastIndex(action => !action.undone)
    
    if (lastActionIndex === -1) {
      return {
        success: false,
        message: "There's nothing to undo right now."
      }
    }

    const lastAction = session.recipeActions[lastActionIndex]
    const recipe = await prisma.recipe.findUnique({ where: { id: lastAction.recipeId } })

    // Mark the action as undone
    lastAction.undone = true

    // Reverse the action
    if (lastAction.action === 'accept') {
      session.acceptedRecipes = session.acceptedRecipes.filter(id => id !== lastAction.recipeId)
    } else if (lastAction.action === 'decline') {
      session.declinedRecipes = session.declinedRecipes.filter(id => id !== lastAction.recipeId)
    }

    const undoMessage = `I've undone your ${lastAction.action} of **${recipe?.title}**. You can now make a different choice about this recipe.`
    
    this.addMessage(sessionId, 'assistant', undoMessage)
    session.updatedAt = new Date()
    globalSessionStore.setSession(sessionId, session)

    return {
      success: true,
      message: undoMessage,
      undoneAction: lastAction
    }
  }

  /**
   * Get session summary for confirmation before finalizing
   */
  async getSessionSummary(sessionId: string): Promise<{
    acceptedRecipes: Array<{ id: number; title: string; summary?: string }>
    declinedRecipes: Array<{ id: number; title: string; reason?: string }>
    totalInteractions: number
    sessionDuration: string
    canFinalize: boolean
  }> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get accepted recipes with details
    const acceptedRecipes = await Promise.all(
      session.acceptedRecipes.map(async (id) => {
        const recipe = await prisma.recipe.findUnique({ where: { id } })
        return {
          id,
          title: recipe?.title || 'Unknown Recipe',
          summary: recipe?.summary
        }
      })
    )

    // Get declined recipes with reasons
    const declinedRecipes = await Promise.all(
      session.declinedRecipes.map(async (id) => {
        const recipe = await prisma.recipe.findUnique({ where: { id } })
        const lastDeclineAction = session.recipeActions
          .filter(action => action.recipeId === id && action.action === 'decline' && !action.undone)
          .pop()
        
        return {
          id,
          title: recipe?.title || 'Unknown Recipe',
          reason: lastDeclineAction?.reason
        }
      })
    )

    // Calculate session duration
    const duration = new Date().getTime() - session.createdAt.getTime()
    const minutes = Math.floor(duration / 60000)
    const sessionDuration = minutes < 60 
      ? `${minutes} minutes`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`

    const canFinalize = acceptedRecipes.length > 0

    return {
      acceptedRecipes,
      declinedRecipes,
      totalInteractions: session.recipeActions.filter(a => !a.undone).length,
      sessionDuration,
      canFinalize
    }
  }

  /**
   * Finalize the meal plan and mark session as completed
   */
  async finalizeMealPlan(sessionId: string): Promise<{ success: boolean; message: string; mealPlanId?: number }> {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    if (session.acceptedRecipes.length === 0) {
      return {
        success: false,
        message: "You haven't accepted any recipes yet. Add some recipes to your plan before finalizing."
      }
    }

    try {
      // Create meal plan in database
      const mealPlan = await prisma.mealPlan.create({
        data: {
          userId: session.userId,
          status: 'active'
        }
      })

      // Add planned recipes
      await Promise.all(
        session.acceptedRecipes.map(recipeId =>
          prisma.plannedRecipe.create({
            data: {
              mealPlanId: mealPlan.id,
              recipeId,
              completed: false
            }
          })
        )
      )

      // Mark session as completed
      globalSessionStore.completeSession(sessionId)

      const finalMessage = `Perfect! I've created your meal plan with ${session.acceptedRecipes.length} recipe${session.acceptedRecipes.length !== 1 ? 's' : ''}. You can view and manage your plan in the Planner tab. Happy cooking! 🍳`
      
      this.addMessage(sessionId, 'assistant', finalMessage)

      return {
        success: true,
        message: finalMessage,
        mealPlanId: mealPlan.id
      }

    } catch (error) {
      console.error('Error finalizing meal plan:', error)
      return {
        success: false,
        message: "Sorry, I couldn't save your meal plan right now. Please try again."
      }
    }
  }

  /**
   * Get recent actions for undo functionality
   */
  getRecentActions(sessionId: string, limit = 5): RecipeAction[] {
    const session = globalSessionStore.getSession(sessionId)
    if (!session) {
      return []
    }

    return session.recipeActions
      .filter(action => !action.undone)
      .slice(-limit)
      .reverse() // Most recent first
  }

  /**
   * Get conversation session
   */
  getSession(sessionId: string): MealPlanningSession | undefined {
    return globalSessionStore.getSession(sessionId)
  }

  /**
   * Generate welcome message based on user's recipe collection
   */
  private async generateWelcomeMessage(userId: string): Promise<string> {
    const recipeCount = await prisma.recipe.count()
    const currentMonth = new Date().toLocaleString('default', { month: 'long' })

    return `Hi there! I'm your personal recipe planning assistant. I can help you plan your meals using your collection of ${recipeCount} recipes.

Since it's ${currentMonth}, I'll prioritize seasonal recipes that are perfect for this time of year. Just tell me what you're looking for - maybe "I need 3 quick dinners for this week" or "What's a good vegetarian lunch option?" 

What would you like to cook? 🍳`
  }

  /**
   * Add message to conversation history
   */
  private addMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const session = globalSessionStore.getSession(sessionId)
    if (session) {
      session.messages.push({
        role,
        content,
        timestamp: new Date()
      })
      globalSessionStore.setSession(sessionId, session) // Update the session
    }
  }

  /**
   * Extract filtering criteria from user input using simple keyword matching
   */
  private async extractCriteriaFromInput(
    input: string, 
    currentCriteria: RecipeFilterCriteria
  ): Promise<Partial<RecipeFilterCriteria>> {
    const lowerInput = input.toLowerCase()
    const extracted: Partial<RecipeFilterCriteria> = {}

    // Dietary restrictions
    const dietaryKeywords = {
      vegetarian: ['vegetarian', 'veggie', 'no meat'],
      vegan: ['vegan', 'plant-based'],
      'gluten-free': ['gluten-free', 'gluten free', 'no gluten'],
      'dairy-free': ['dairy-free', 'dairy free', 'no dairy', 'lactose-free'],
      'nut-free': ['nut-free', 'nut free', 'no nuts']
    }

    const foundDietary: string[] = []
    for (const [restriction, keywords] of Object.entries(dietaryKeywords)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        foundDietary.push(restriction)
      }
    }
    if (foundDietary.length > 0) {
      extracted.dietaryRestrictions = [...(currentCriteria.dietaryRestrictions || []), ...foundDietary]
    }

    // Meal types
    const mealKeywords = {
      breakfast: ['breakfast', 'morning', 'brunch'],
      lunch: ['lunch', 'midday'],
      dinner: ['dinner', 'evening', 'supper'],
      snack: ['snack', 'appetizer'],
      dessert: ['dessert', 'sweet', 'cake', 'cookie']
    }

    const foundMeals: string[] = []
    for (const [meal, keywords] of Object.entries(mealKeywords)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        foundMeals.push(meal)
      }
    }
    if (foundMeals.length > 0) {
      extracted.mealTypes = foundMeals
    }

    // Cooking methods
    if (lowerInput.includes('quick') || lowerInput.includes('fast') || lowerInput.includes('easy')) {
      extracted.cookingMethods = ['quick & easy']
    }

    // Time constraints
    const timeMatch = lowerInput.match(/(\d+)\s*min/)
    if (timeMatch) {
      extracted.maxCookingTime = parseInt(timeMatch[1])
    }

    return extracted
  }

  /**
   * Get filtered recipes based on session criteria
   */
  private async getFilteredRecipes(session: MealPlanningSession): Promise<Recipe[]> {
    const allRecipes = await prisma.recipe.findMany({
      include: { ingredients: true }
    })

    let filtered = filterRecipes(allRecipes, {
      seasonality: session.currentCriteria.seasonality,
      tags: [
        ...(session.currentCriteria.dietaryRestrictions || []),
        ...(session.currentCriteria.mealTypes || []),
        ...(session.currentCriteria.cookingMethods || []),
        ...(session.currentCriteria.cuisines || [])
      ],
      requiredIngredients: session.currentCriteria.requiredIngredients,
      excludedIngredients: session.currentCriteria.excludedIngredients
    })

    // Filter by cooking time
    if (session.currentCriteria.maxCookingTime) {
      filtered = filtered.filter(recipe => recipe.time <= session.currentCriteria.maxCookingTime!)
    }

    // Exclude already accepted/declined recipes
    if (session.currentCriteria.excludeAccepted) {
      filtered = filtered.filter(recipe => !session.acceptedRecipes.includes(recipe.id))
    }
    if (session.currentCriteria.excludeDeclined) {
      filtered = filtered.filter(recipe => !session.declinedRecipes.includes(recipe.id))
    }

    // Sort by rating and seasonality
    return filtered.sort((a, b) => {
      // Prefer higher rated recipes
      if (a.grade !== b.grade) {
        return b.grade - a.grade
      }
      // Then by time (shorter cooking time preferred)
      return a.time - b.time
    })
  }

  /**
   * Format recipe for AI context
   */
  private formatRecipeForAI(recipe: Recipe) {
    return {
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      tags: (recipe as any).tags || '[]', // Handle missing tags field
      startSeason: recipe.startSeason,
      endSeason: recipe.endSeason,
      time: recipe.time,
      grade: recipe.grade
    }
  }

  /**
   * Extract recipe suggestions from AI response
   */
  private extractRecipeSuggestions(response: string, availableRecipes: Recipe[]): RecipeRecommendation[] {
    const suggestions: RecipeRecommendation[] = []

    // Look for recipe titles mentioned in the response
    for (const recipe of availableRecipes) {
      if (response.includes(recipe.title)) {
        suggestions.push({
          recipe,
          reason: 'Mentioned in AI response',
          confidence: 0.9
        })
      }
    }

    return suggestions
  }
}

// Export singleton instance
export const mealPlanningChain = new MealPlanningConversationChain() 