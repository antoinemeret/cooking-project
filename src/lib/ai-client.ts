import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'

// Claude Sonnet 4 model configuration
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'

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
 * AI client interface for recipe conversations
 */
export class RecipeAssistantAI {
  private client: ChatAnthropic
  private prompt: ChatPromptTemplate

  constructor() {
    this.client = createClaudeClient()
    this.prompt = createRecipeConversationPrompt()
  }

  /**
   * Generate a response for recipe conversation
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
  ) {
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

    const response = await chain.invoke({
      conversation_history: formattedHistory,
      user_input: contextualInput,
    })

    return response.content as string
  }

  /**
   * Generate streaming response for real-time chat
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
  ) {
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

    const stream = await chain.stream({
      conversation_history: formattedHistory,
      user_input: contextualInput,
    })

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content as string
      }
    }
  }
}

// Export singleton instance
export const recipeAssistantAI = new RecipeAssistantAI() 