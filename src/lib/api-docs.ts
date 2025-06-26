/**
 * API Documentation and Validation Schemas
 * Conversational Recipe Planning Assistant
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp?: Date
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
}

// Chat API Types
export interface ChatRequest {
  sessionId: string
  userInput: string
  userId?: string
  streaming?: boolean
}

export interface ChatResponse {
  success: boolean
  sessionId: string
  response: string
  suggestedRecipes?: Array<{
    recipe: {
      id: number
      title: string
      summary: string
      time: number
      grade: number
    }
    reason: string
    confidence: number
  }>
  sessionStats?: {
    duration: number
    messagesExchanged: number
    recipesConsidered: number
    acceptanceRate: number
    currentGoal: string | null
  }
}

export interface StreamingChatChunk {
  type: 'chunk' | 'complete' | 'error'
  content?: string
  sessionId?: string
  fullResponse?: string
  error?: string
}

// Session Management Types
export interface SessionCreateRequest {
  userId?: string
}

export interface SessionCreateResponse {
  success: boolean
  sessionId: string
  welcomeMessage: string
}

export interface SessionInfoResponse {
  success: boolean
  session: {
    id: string
    userId: string
    messagesCount: number
    acceptedRecipes: number[]
    declinedRecipes: number[]
    createdAt: Date
    updatedAt: Date
  }
  stats: {
    duration: number
    messagesExchanged: number
    recipesConsidered: number
    acceptanceRate: number
    currentGoal: string | null
  }
}

// Recipe Action Types
export interface RecipeActionRequest {
  sessionId: string
  recipeId: string | number
  action: 'accept' | 'decline'
  reason?: string
  userId?: string
}

export interface RecipeActionResponse {
  success: boolean
  sessionId: string
  action: 'accept' | 'decline'
  recipe: {
    id: number
    title: string
  }
  aiResponse: string
}

export interface MealPlanStatusResponse {
  success: boolean
  mealPlan: {
    id: number
    status: string
    createdAt: Date
    updatedAt: Date
    plannedRecipes: Array<{
      id: number
      completed: boolean
      addedAt: Date
      recipe: {
        id: number
        title: string
        summary: string
        time: number
        grade: number
      }
    }>
  } | null
  sessionStats?: {
    duration: number
    messagesExchanged: number
    recipesConsidered: number
    acceptanceRate: number
    currentGoal: string | null
  }
}

// Grocery List Types
export interface GroceryListGenerateRequest {
  userId: string
  regenerate?: boolean
}

export interface GroceryListItem {
  name: string
  source: 'normalized' | 'raw'
  recipes: string[]
}

export interface GroceryListResponse {
  success: boolean
  groceryList: {
    id: number
    mealPlanId: number
    ingredients: GroceryListItem[]
    checkedItems: string[]
    createdAt: Date
    updatedAt: Date
  } | null
  recipeCount?: number
  mealPlan?: {
    id: number
    recipeCount: number
    recipes: Array<{
      id: number
      title: string
      completed: boolean
    }>
  } | null
}

export interface GroceryListUpdateRequest {
  groceryListId: number
  itemName: string
  checked: boolean
}

// Validation Functions
export function validateChatRequest(body: any): ChatRequest | null {
  if (!body || typeof body !== 'object') return null
  
  const { sessionId, userInput, userId, streaming } = body
  
  if (!sessionId || typeof sessionId !== 'string') return null
  if (!userInput || typeof userInput !== 'string') return null
  if (userId !== undefined && typeof userId !== 'string') return null
  if (streaming !== undefined && typeof streaming !== 'boolean') return null
  
  return {
    sessionId,
    userInput,
    userId: userId || 'anonymous',
    streaming: streaming ?? true
  }
}

export function validateRecipeActionRequest(body: any): RecipeActionRequest | null {
  if (!body || typeof body !== 'object') return null
  
  const { sessionId, recipeId, action, reason, userId } = body
  
  if (!sessionId || typeof sessionId !== 'string') return null
  if (!recipeId || (typeof recipeId !== 'string' && typeof recipeId !== 'number')) return null
  if (!action || !['accept', 'decline'].includes(action)) return null
  if (reason !== undefined && typeof reason !== 'string') return null
  if (userId !== undefined && typeof userId !== 'string') return null
  
  return {
    sessionId,
    recipeId,
    action,
    reason,
    userId: userId || 'anonymous'
  }
}

export function validateGroceryListGenerateRequest(body: any): GroceryListGenerateRequest | null {
  if (!body || typeof body !== 'object') return null
  
  const { userId, regenerate } = body
  
  if (!userId || typeof userId !== 'string') return null
  if (regenerate !== undefined && typeof regenerate !== 'boolean') return null
  
  return {
    userId,
    regenerate: regenerate ?? false
  }
}

export function validateGroceryListUpdateRequest(body: any): GroceryListUpdateRequest | null {
  if (!body || typeof body !== 'object') return null
  
  const { groceryListId, itemName, checked } = body
  
  if (!groceryListId || typeof groceryListId !== 'number') return null
  if (!itemName || typeof itemName !== 'string') return null
  if (typeof checked !== 'boolean') return null
  
  return {
    groceryListId,
    itemName,
    checked
  }
}

// Error Types and Messages
export const API_ERRORS = {
  // General
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_REQUEST_BODY: 'Invalid request body',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  GLOBAL_RATE_LIMIT_EXCEEDED: 'Global rate limit exceeded. Please try again later.',
  
  // Session Management
  SESSION_NOT_FOUND: 'Session not found',
  SESSION_EXPIRED: 'Session has expired',
  INVALID_SESSION_ID: 'Invalid session ID format',
  
  // Recipe Actions
  RECIPE_NOT_FOUND: 'Recipe not found',
  INVALID_RECIPE_ID: 'Invalid recipe ID format',
  INVALID_ACTION: 'Action must be "accept" or "decline"',
  
  // Meal Planning
  NO_ACTIVE_MEAL_PLAN: 'No active meal plan found',
  NO_RECIPES_IN_MEAL_PLAN: 'No recipes in meal plan to generate grocery list',
  
  // Grocery List
  GROCERY_LIST_NOT_FOUND: 'Grocery list not found',
  INVALID_GROCERY_LIST_ID: 'Invalid grocery list ID format',
  ITEM_NAME_REQUIRED: 'Item name is required',
  CHECKED_STATUS_REQUIRED: 'Checked status must be boolean',
  
  // User Management
  USER_ID_REQUIRED: 'User ID is required',
  INVALID_USER_ID: 'Invalid user ID format'
} as const

export type ApiErrorType = keyof typeof API_ERRORS

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const

// API Endpoint Documentation
export const API_ENDPOINTS = {
  // Chat Endpoints
  CHAT: {
    path: '/api/assistant/chat',
    methods: ['POST', 'PUT', 'GET'],
    description: 'Handle conversational interactions with the recipe assistant',
    rateLimit: '10 requests per hour per IP',
    examples: {
      POST: {
        request: {
          sessionId: 'session_user123_1640995200000',
          userInput: 'I need 3 quick dinner recipes for this week',
          userId: 'user123',
          streaming: true
        },
        response: {
          success: true,
          sessionId: 'session_user123_1640995200000',
          response: 'Great! I can help you find quick dinner recipes...',
          suggestedRecipes: []
        }
      },
      PUT: {
        request: { userId: 'user123' },
        response: {
          success: true,
          sessionId: 'session_user123_1640995200000',
          welcomeMessage: 'Hi there! I\'m your personal recipe planning assistant...'
        }
      }
    }
  },
  
  // Recipe Action Endpoints
  RECIPE_ACTION: {
    path: '/api/assistant/recipe-action',
    methods: ['POST', 'GET'],
    description: 'Handle recipe accept/decline actions and meal plan status',
    rateLimit: '10 requests per hour per IP',
    examples: {
      POST: {
        request: {
          sessionId: 'session_user123_1640995200000',
          recipeId: 42,
          action: 'accept',
          userId: 'user123'
        },
        response: {
          success: true,
          sessionId: 'session_user123_1640995200000',
          action: 'accept',
          recipe: { id: 42, title: 'Quick Pasta Salad' },
          aiResponse: 'Great choice! I\'ve added "Quick Pasta Salad" to your meal plan...'
        }
      }
    }
  },
  
  // Grocery List Endpoints
  GROCERY_LIST: {
    path: '/api/assistant/grocery-list',
    methods: ['POST', 'GET', 'PUT'],
    description: 'Generate and manage grocery lists from meal plans',
    rateLimit: '10 requests per hour per IP',
    examples: {
      POST: {
        request: { userId: 'user123', regenerate: false },
        response: {
          success: true,
          groceryList: {
            id: 1,
            mealPlanId: 1,
            ingredients: [
              { name: 'Tomatoes', source: 'normalized', recipes: ['Pasta Salad'] }
            ],
            checkedItems: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          recipeCount: 3
        }
      }
    }
  }
} as const

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
  data: T,
  success: boolean = true,
  error?: string
): ApiResponse<T> {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : error,
    timestamp: new Date()
  }
}

/**
 * Create error response with proper HTTP status
 */
export function createErrorResponse(
  errorType: ApiErrorType,
  statusCode: number = HTTP_STATUS.BAD_REQUEST,
  details?: string
): { response: ApiResponse; status: number } {
  return {
    response: {
      success: false,
      error: details || API_ERRORS[errorType],
      timestamp: new Date()
    },
    status: statusCode
  }
} 