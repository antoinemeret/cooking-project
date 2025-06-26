import { ConversationMessage, RecipeFilterCriteria } from './conversation-chain'

/**
 * User preference tracking for better recipe suggestions
 */
export interface UserPreferences {
  dietaryRestrictions: string[]
  favoriteCuisines: string[]
  dislikedIngredients: string[]
  preferredCookingMethods: string[]
  typicalMealTimes: Record<string, string[]> // day -> meal types
  cookingSkillLevel: 'beginner' | 'intermediate' | 'advanced'
  householdSize: number
  timeConstraints: {
    weeknight: number // max minutes
    weekend: number // max minutes
  }
  seasonalPreferences: boolean
}

/**
 * Conversation context for maintaining session state
 */
export interface ConversationContext {
  currentGoal: 'planning' | 'exploring' | 'using_ingredients' | 'quick_meal' | 'entertaining' | null
  sessionStartTime: Date
  totalMessagesExchanged: number
  recipesConsidered: number[]
  recipesAccepted: number[]
  recipesDeclined: number[]
  declineReasons: Record<number, string[]> // recipeId -> reasons
  lastScenario: string | null
  pendingQuestions: string[]
  contextSummary: string
}

/**
 * Learning patterns from user interactions
 */
export interface LearningPatterns {
  acceptanceRate: number
  preferredRecipeComplexity: 'simple' | 'moderate' | 'complex'
  timeOfDayPatterns: Record<string, number> // hour -> frequency
  seasonalTrends: Record<string, number> // season -> preference score
  cuisineAffinities: Record<string, number> // cuisine -> score
  ingredientPreferences: Record<string, number> // ingredient -> score
  cookingMethodPreferences: Record<string, number> // method -> score
}

/**
 * Memory management for conversation sessions
 */
export class ConversationMemoryManager {
  private sessionMemories: Map<string, ConversationContext> = new Map()
  private userPreferences: Map<string, UserPreferences> = new Map()
  private learningPatterns: Map<string, LearningPatterns> = new Map()
  
  // Memory retention settings
  private readonly MAX_SESSION_DURATION = 2 * 60 * 60 * 1000 // 2 hours
  private readonly MAX_CONTEXT_MESSAGES = 20 // Keep last 20 messages for context
  private readonly LEARNING_WEIGHT = 0.1 // How much each interaction affects learning

  /**
   * Initialize memory for a new session
   */
  initializeSession(sessionId: string, userId: string): ConversationContext {
    const context: ConversationContext = {
      currentGoal: null,
      sessionStartTime: new Date(),
      totalMessagesExchanged: 0,
      recipesConsidered: [],
      recipesAccepted: [],
      recipesDeclined: [],
      declineReasons: {},
      lastScenario: null,
      pendingQuestions: [],
      contextSummary: ''
    }

    this.sessionMemories.set(sessionId, context)
    
    // Initialize user preferences if not exists
    if (!this.userPreferences.has(userId)) {
      this.initializeUserPreferences(userId)
    }

    return context
  }

  /**
   * Update conversation context with new message
   */
  updateConversationContext(
    sessionId: string,
    message: ConversationMessage,
    extractedCriteria?: Partial<RecipeFilterCriteria>,
    scenario?: string
  ): void {
    const context = this.sessionMemories.get(sessionId)
    if (!context) return

    context.totalMessagesExchanged++
    
    if (scenario && scenario !== context.lastScenario) {
      context.lastScenario = scenario
      this.updateGoalFromScenario(context, scenario)
    }

    // Update context summary with key information
    if (message.role === 'user') {
      this.updateContextSummary(context, message.content, extractedCriteria)
    }

    // Clean up old context if session is getting long
    if (context.totalMessagesExchanged > this.MAX_CONTEXT_MESSAGES) {
      this.compressOldContext(context)
    }
  }

  /**
   * Record recipe interaction for learning
   */
  recordRecipeInteraction(
    sessionId: string,
    userId: string,
    recipeId: number,
    action: 'considered' | 'accepted' | 'declined',
    reason?: string,
    recipeData?: {
      tags: string[]
      cuisine?: string
      cookingTime: number
      complexity: 'simple' | 'moderate' | 'complex'
      ingredients: string[]
    }
  ): void {
    const context = this.sessionMemories.get(sessionId)
    if (!context) return

    switch (action) {
      case 'considered':
        if (!context.recipesConsidered.includes(recipeId)) {
          context.recipesConsidered.push(recipeId)
        }
        break
      
      case 'accepted':
        context.recipesAccepted.push(recipeId)
        if (recipeData) {
          this.updateLearningFromAcceptance(userId, recipeData)
        }
        break
      
      case 'declined':
        context.recipesDeclined.push(recipeId)
        if (reason) {
          if (!context.declineReasons[recipeId]) {
            context.declineReasons[recipeId] = []
          }
          context.declineReasons[recipeId].push(reason)
          
          if (recipeData) {
            this.updateLearningFromDecline(userId, recipeData, reason)
          }
        }
        break
    }
  }

  /**
   * Get enriched context for AI prompting
   */
  getEnrichedContext(sessionId: string, userId: string): {
    preferences: UserPreferences
    context: ConversationContext
    patterns: LearningPatterns
    contextualInsights: string[]
  } {
    const context = this.sessionMemories.get(sessionId)
    const preferences = this.userPreferences.get(userId)
    const patterns = this.learningPatterns.get(userId)

    if (!context || !preferences || !patterns) {
      throw new Error('Session or user data not found')
    }

    const insights = this.generateContextualInsights(context, preferences, patterns)

    return {
      preferences,
      context,
      patterns,
      contextualInsights: insights
    }
  }

  /**
   * Get memory-informed recipe filtering criteria
   */
  getMemoryInformedCriteria(
    sessionId: string,
    userId: string,
    baseCriteria: RecipeFilterCriteria
  ): RecipeFilterCriteria {
    const preferences = this.userPreferences.get(userId)
    const patterns = this.learningPatterns.get(userId)
    
    if (!preferences || !patterns) return baseCriteria

    const enhancedCriteria: RecipeFilterCriteria = {
      ...baseCriteria,
      
      // Add user's dietary restrictions
      dietaryRestrictions: [
        ...(baseCriteria.dietaryRestrictions || []),
        ...preferences.dietaryRestrictions
      ],
      
      // Exclude disliked ingredients
      excludedIngredients: [
        ...(baseCriteria.excludedIngredients || []),
        ...preferences.dislikedIngredients
      ],
      
      // Apply time constraints based on preferences
      maxCookingTime: baseCriteria.maxCookingTime || this.getPreferredCookingTime(preferences),
      
      // Use seasonal preferences
      seasonality: baseCriteria.seasonality ?? preferences.seasonalPreferences
    }

    return enhancedCriteria
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now()
    
    for (const [sessionId, context] of this.sessionMemories.entries()) {
      const sessionAge = now - context.sessionStartTime.getTime()
      if (sessionAge > this.MAX_SESSION_DURATION) {
        this.sessionMemories.delete(sessionId)
      }
    }
  }

  /**
   * Get session statistics for debugging
   */
  getSessionStats(sessionId: string): {
    duration: number
    messagesExchanged: number
    recipesConsidered: number
    acceptanceRate: number
    currentGoal: string | null
  } | null {
    const context = this.sessionMemories.get(sessionId)
    if (!context) return null

    const duration = Date.now() - context.sessionStartTime.getTime()
    const acceptanceRate = context.recipesConsidered.length > 0
      ? context.recipesAccepted.length / context.recipesConsidered.length
      : 0

    return {
      duration,
      messagesExchanged: context.totalMessagesExchanged,
      recipesConsidered: context.recipesConsidered.length,
      acceptanceRate,
      currentGoal: context.currentGoal
    }
  }

  // Private helper methods

  private initializeUserPreferences(userId: string): void {
    const defaultPreferences: UserPreferences = {
      dietaryRestrictions: [],
      favoriteCuisines: [],
      dislikedIngredients: [],
      preferredCookingMethods: [],
      typicalMealTimes: {},
      cookingSkillLevel: 'intermediate',
      householdSize: 2,
      timeConstraints: {
        weeknight: 45,
        weekend: 90
      },
      seasonalPreferences: true
    }

    const defaultPatterns: LearningPatterns = {
      acceptanceRate: 0.5,
      preferredRecipeComplexity: 'moderate',
      timeOfDayPatterns: {},
      seasonalTrends: {},
      cuisineAffinities: {},
      ingredientPreferences: {},
      cookingMethodPreferences: {}
    }

    this.userPreferences.set(userId, defaultPreferences)
    this.learningPatterns.set(userId, defaultPatterns)
  }

  private updateGoalFromScenario(context: ConversationContext, scenario: string): void {
    const goalMapping: Record<string, ConversationContext['currentGoal']> = {
      'weeklyPlanning': 'planning',
      'cuisineExploration': 'exploring',
      'ingredientFocused': 'using_ingredients',
      'quickMeals': 'quick_meal',
      'entertaining': 'entertaining'
    }

    context.currentGoal = goalMapping[scenario] || null
  }

  private updateContextSummary(
    context: ConversationContext,
    userMessage: string,
    criteria?: Partial<RecipeFilterCriteria>
  ): void {
    const keyPoints: string[] = []

    // Extract key information from user message
    if (criteria?.dietaryRestrictions?.length) {
      keyPoints.push(`Dietary: ${criteria.dietaryRestrictions.join(', ')}`)
    }
    if (criteria?.mealTypes?.length) {
      keyPoints.push(`Meals: ${criteria.mealTypes.join(', ')}`)
    }
    if (criteria?.maxCookingTime) {
      keyPoints.push(`Time: ${criteria.maxCookingTime}min`)
    }

    // Add to context summary
    if (keyPoints.length > 0) {
      context.contextSummary = keyPoints.join(' | ')
    }
  }

  private compressOldContext(context: ConversationContext): void {
    // Keep essential information but reduce detail
    // This is where we'd implement more sophisticated context compression
    // For now, just reset message count to prevent memory bloat
    context.totalMessagesExchanged = this.MAX_CONTEXT_MESSAGES
  }

  private updateLearningFromAcceptance(
    userId: string,
    recipeData: {
      tags: string[]
      cuisine?: string
      cookingTime: number
      complexity: 'simple' | 'moderate' | 'complex'
      ingredients: string[]
    }
  ): void {
    const patterns = this.learningPatterns.get(userId)
    if (!patterns) return

    // Update cuisine affinities
    if (recipeData.cuisine) {
      patterns.cuisineAffinities[recipeData.cuisine] = 
        (patterns.cuisineAffinities[recipeData.cuisine] || 0) + this.LEARNING_WEIGHT
    }

    // Update ingredient preferences
    recipeData.ingredients.forEach(ingredient => {
      patterns.ingredientPreferences[ingredient] = 
        (patterns.ingredientPreferences[ingredient] || 0) + this.LEARNING_WEIGHT
    })

    // Update complexity preference
    if (recipeData.complexity === patterns.preferredRecipeComplexity) {
      // Reinforce current preference
    } else {
      // Slight shift towards accepted complexity
      patterns.preferredRecipeComplexity = recipeData.complexity
    }
  }

  private updateLearningFromDecline(
    userId: string,
    recipeData: {
      tags: string[]
      cuisine?: string
      cookingTime: number
      complexity: 'simple' | 'moderate' | 'complex'
      ingredients: string[]
    },
    reason: string
  ): void {
    const patterns = this.learningPatterns.get(userId)
    const preferences = this.userPreferences.get(userId)
    if (!patterns || !preferences) return

    // Analyze decline reason and update preferences
    const reasonLower = reason.toLowerCase()

    if (reasonLower.includes('too spicy') || reasonLower.includes('spicy')) {
      // Add spicy ingredients to disliked list
      const spicyIngredients = ['chili', 'pepper', 'hot sauce', 'cayenne']
      spicyIngredients.forEach(ingredient => {
        if (recipeData.ingredients.some(ing => ing.toLowerCase().includes(ingredient))) {
          if (!preferences.dislikedIngredients.includes(ingredient)) {
            preferences.dislikedIngredients.push(ingredient)
          }
        }
      })
    }

    if (reasonLower.includes('too long') || reasonLower.includes('time')) {
      // Adjust time preferences
      if (recipeData.cookingTime > preferences.timeConstraints.weeknight) {
        preferences.timeConstraints.weeknight = Math.min(
          preferences.timeConstraints.weeknight,
          recipeData.cookingTime - 10
        )
      }
    }

    // Reduce affinity for declined cuisine
    if (recipeData.cuisine) {
      patterns.cuisineAffinities[recipeData.cuisine] = 
        (patterns.cuisineAffinities[recipeData.cuisine] || 0) - this.LEARNING_WEIGHT
    }
  }

  private generateContextualInsights(
    context: ConversationContext,
    preferences: UserPreferences,
    patterns: LearningPatterns
  ): string[] {
    const insights: string[] = []

    // Session-based insights
    if (context.recipesDeclined.length > context.recipesAccepted.length) {
      insights.push("User seems to be having trouble finding suitable recipes")
    }

    if (context.currentGoal === 'planning' && context.recipesAccepted.length >= 3) {
      insights.push("User is successfully building a meal plan")
    }

    // Pattern-based insights
    if (patterns.acceptanceRate < 0.3) {
      insights.push("User has low acceptance rate - may need more targeted suggestions")
    }

    // Preference-based insights
    if (preferences.dietaryRestrictions.length > 0) {
      insights.push(`User has dietary restrictions: ${preferences.dietaryRestrictions.join(', ')}`)
    }

    return insights
  }

  private getPreferredCookingTime(preferences: UserPreferences): number {
    const now = new Date()
    const hour = now.getHours()
    const isWeekend = now.getDay() === 0 || now.getDay() === 6

    return isWeekend ? preferences.timeConstraints.weekend : preferences.timeConstraints.weeknight
  }
}

// Export singleton instance
export const conversationMemory = new ConversationMemoryManager() 