/**
 * Simple analytics tracking for the conversational recipe assistant
 * Tracks user interactions and success metrics
 */

interface AnalyticsEvent {
  event: string
  properties: Record<string, any>
  timestamp: Date
  sessionId?: string
  userId?: string
}

class Analytics {
  private events: AnalyticsEvent[] = []
  private sessionId: string
  private userId?: string

  constructor() {
    this.sessionId = this.generateSessionId()
    this.loadUserId()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private loadUserId(): void {
    if (typeof window !== 'undefined') {
      this.userId = localStorage.getItem('analytics_user_id') || undefined
      if (!this.userId) {
        this.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem('analytics_user_id', this.userId)
      }
    }
  }

  /**
   * Track an event
   */
  track(event: string, properties: Record<string, any> = {}): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId
    }

    this.events.push(analyticsEvent)
    
    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics:', event, properties)
    }

    // In production, you would send this to your analytics service
    this.sendToAnalyticsService(analyticsEvent)
  }

  private async sendToAnalyticsService(event: AnalyticsEvent): Promise<void> {
    // In a real implementation, you would send to your analytics service
    // For now, we'll just store in localStorage for demo purposes
    try {
      if (typeof window !== 'undefined') {
        const storedEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]')
        storedEvents.push(event)
        
        // Keep only last 50 events in storage
        const recentEvents = storedEvents.slice(-50)
        localStorage.setItem('analytics_events', JSON.stringify(recentEvents))
      }
    } catch (error) {
      console.error('Failed to store analytics event:', error)
    }
  }

  /**
   * Track conversation metrics
   */
  trackConversationStart(): void {
    this.track('conversation_started', {
      timestamp: new Date().toISOString()
    })
  }

  trackConversationEnd(metrics: {
    duration: number
    messageCount: number
    recipesAccepted: number
    recipesDeclined: number
    completed: boolean
  }): void {
    this.track('conversation_ended', {
      ...metrics,
      timestamp: new Date().toISOString()
    })
  }

  trackRecipeAction(action: 'accept' | 'decline', recipeId: number, reason?: string): void {
    this.track('recipe_action', {
      action,
      recipeId,
      reason,
      timestamp: new Date().toISOString()
    })
  }

  trackMealPlanCompletion(metrics: {
    totalRecipes: number
    completedRecipes: number
    timeToComplete: number
  }): void {
    this.track('meal_plan_completed', {
      ...metrics,
      completionRate: metrics.completedRecipes / metrics.totalRecipes,
      timestamp: new Date().toISOString()
    })
  }

  trackGroceryListUsage(metrics: {
    totalItems: number
    checkedItems: number
    timeSpent: number
  }): void {
    this.track('grocery_list_used', {
      ...metrics,
      completionRate: metrics.checkedItems / metrics.totalItems,
      timestamp: new Date().toISOString()
    })
  }

  trackError(error: {
    type: string
    message: string
    context?: string
  }): void {
    this.track('error_occurred', {
      ...error,
      timestamp: new Date().toISOString()
    })
  }

  trackPerformance(metric: {
    operation: string
    duration: number
    success: boolean
  }): void {
    this.track('performance_metric', {
      ...metric,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Get analytics summary for debugging/monitoring
   */
  getSummary(): {
    totalEvents: number
    sessionDuration: number
    topEvents: Array<{ event: string; count: number }>
  } {
    const eventCounts = this.events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }))

    const sessionStart = this.events.length > 0 ? this.events[0].timestamp : new Date()
    const sessionDuration = Date.now() - sessionStart.getTime()

    return {
      totalEvents: this.events.length,
      sessionDuration,
      topEvents
    }
  }

  /**
   * Get stored analytics data (for debugging)
   */
  getStoredEvents(): AnalyticsEvent[] {
    if (typeof window === 'undefined') return []
    
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]')
    } catch {
      return []
    }
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.events = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analytics_events')
    }
  }
}

// Export singleton instance
const analytics = new Analytics()

// Convenience functions for common tracking scenarios
export const trackConversationStart = () => analytics.trackConversationStart()

export const trackConversationEnd = (metrics: {
  duration: number
  messageCount: number
  recipesAccepted: number
  recipesDeclined: number
  completed: boolean
}) => analytics.trackConversationEnd(metrics)

export const trackRecipeAction = (action: 'accept' | 'decline', recipeId: number, reason?: string) =>
  analytics.trackRecipeAction(action, recipeId, reason)

export const trackMealPlanCompletion = (metrics: {
  totalRecipes: number
  completedRecipes: number
  timeToComplete: number
}) => analytics.trackMealPlanCompletion(metrics)

export const trackGroceryListUsage = (metrics: {
  totalItems: number
  checkedItems: number
  timeSpent: number
}) => analytics.trackGroceryListUsage(metrics)

export const trackError = (error: {
  type: string
  message: string
  context?: string
}) => analytics.trackError(error)

export const trackPerformance = (metric: {
  operation: string
  duration: number
  success: boolean
}) => analytics.trackPerformance(metric)

// Export the analytics instance
export { analytics } 