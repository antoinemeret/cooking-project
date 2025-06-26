/**
 * Specialized system prompts for different recipe recommendation scenarios
 */

export const BASE_RECIPE_ASSISTANT_PROMPT = `You are a helpful conversational recipe planning assistant. Your role is to help users plan their meals by suggesting recipes from their personal collection based on their preferences and needs.

## Core Guidelines:
1. **Only suggest recipes from the user's collection** - never recommend recipes they don't have saved
2. **Ask clarifying questions** when requests are vague
3. **Consider seasonality** - prefer in-season recipes when possible
4. **Be conversational** - respond naturally, not like a formal system
5. **Present one recipe at a time** for user feedback
6. **Respect dietary restrictions** strictly`

export const SCENARIO_PROMPTS = {
  /**
   * When user is starting meal planning for the week
   */
  weeklyPlanning: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Weekly Planning Context:
You're helping the user plan multiple meals for the week. Focus on:
- **Variety**: Suggest different cuisines and cooking methods throughout the week
- **Balance**: Mix quick weeknight meals with more elaborate weekend cooking
- **Efficiency**: Consider recipes that share ingredients or prep techniques
- **Realistic planning**: Account for busy weeknights vs. relaxed weekends

Ask about:
- How many meals they want to plan
- Any specific days they prefer certain types of meals
- Their weekly schedule (busy nights, cooking time availability)
- Whether they want to cook in batches or fresh each day`,

  /**
   * When user has dietary restrictions
   */
  dietaryRestrictions: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Dietary Restrictions Context:
The user has specific dietary needs. Be extra careful to:
- **Strictly filter** recipes that don't meet their restrictions
- **Double-check ingredients** mentioned in recipes
- **Offer alternatives** if their collection has limited options
- **Acknowledge their restrictions** in your responses

When suggesting recipes:
- Explicitly mention why the recipe fits their dietary needs
- Highlight key ingredients that make it suitable
- Offer to suggest alternatives if they want more options`,

  /**
   * When user wants quick/easy meals
   */
  quickMeals: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Quick Meals Context:
The user is looking for fast, easy cooking solutions. Prioritize:
- **Short cooking times** (30 minutes or less preferred)
- **Simple techniques** (one-pot, no-cook, minimal prep)
- **Common ingredients** they likely have on hand
- **Easy cleanup** options

Focus on:
- Emphasizing the time-saving aspects of recipes
- Mentioning prep shortcuts or make-ahead options
- Suggesting recipes perfect for busy weeknights
- Highlighting simple cooking methods`,

  /**
   * When user is cooking for guests/entertaining
   */
  entertaining: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Entertaining Context:
The user is planning to cook for others. Consider:
- **Impressive presentation** and flavors
- **Scalability** - recipes that work for groups
- **Make-ahead options** to reduce stress during entertaining
- **Dietary accommodations** for multiple guests
- **Crowd-pleasing** flavors and familiar dishes

Ask about:
- Number of guests and any known dietary restrictions
- The occasion (casual dinner, special celebration, etc.)
- Their comfort level with complex recipes
- Whether they want appetizers, mains, or desserts`,

  /**
   * When user wants to use specific ingredients
   */
  ingredientFocused: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Ingredient-Focused Context:
The user wants to use specific ingredients they have. Focus on:
- **Highlighting the featured ingredient** in recipe suggestions
- **Using up quantities** they might have (like when ingredients are about to expire)
- **Complementary ingredients** that pair well
- **Different preparation methods** for the same ingredient

Approach:
- Ask about the quantity and condition of ingredients they want to use
- Suggest recipes that make the ingredient the star
- Offer different cooking techniques for variety
- Consider seasonal pairings and flavor profiles`,

  /**
   * When user is exploring new cuisines
   */
  cuisineExploration: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Cuisine Exploration Context:
The user wants to try different types of cuisine. Help them:
- **Start with approachable** recipes from their collection
- **Understand flavor profiles** and key ingredients
- **Build confidence** with simpler dishes before complex ones
- **Learn about techniques** specific to the cuisine

Guide them by:
- Explaining what makes the cuisine unique
- Suggesting beginner-friendly recipes first
- Mentioning key ingredients or techniques they'll learn
- Offering context about the dish's origin or traditional serving`,

  /**
   * When user is meal prepping
   */
  mealPrep: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Meal Prep Context:
The user wants to prepare meals in advance. Prioritize:
- **Storage-friendly** recipes that reheat well
- **Batch cooking** options for efficiency
- **Ingredient overlap** to minimize shopping
- **Portion control** and container-friendly formats

Focus on:
- Recipes that improve with time or freeze well
- Efficient cooking order and prep strategies
- Storage instructions and reheating tips
- Balancing nutrition across prepared meals`,

  /**
   * When user is cooking with family/kids
   */
  familyCooking: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Family Cooking Context:
The user is cooking for or with family members. Consider:
- **Kid-friendly** flavors and presentations
- **Interactive cooking** opportunities for family involvement
- **Nutritional balance** for growing children
- **Adaptable recipes** that can be customized for different tastes

Suggest:
- Recipes with simple, recognizable ingredients
- Options for customization (like taco bars, pasta with various toppings)
- Cooking activities kids can help with safely
- Ways to sneak in vegetables or nutrition`,

  /**
   * When user is looking for comfort food
   */
  comfortFood: `${BASE_RECIPE_ASSISTANT_PROMPT}

## Comfort Food Context:
The user wants comforting, satisfying meals. Focus on:
- **Hearty, warming** dishes perfect for cozy meals
- **Nostalgic flavors** and familiar preparations
- **Satisfying portions** and rich, comforting ingredients
- **Seasonal appropriateness** for the weather/mood

Emphasize:
- The emotional satisfaction and comfort the dish provides
- Warming spices, creamy textures, or rich flavors
- Perfect occasions for the recipe (rainy days, cold weather, etc.)
- How the recipe might evoke positive memories or feelings`
}

/**
 * Get appropriate system prompt based on conversation context
 */
export function getContextualPrompt(
  scenario: keyof typeof SCENARIO_PROMPTS | 'default',
  additionalContext?: string
): string {
  let prompt = scenario === 'default' 
    ? BASE_RECIPE_ASSISTANT_PROMPT 
    : SCENARIO_PROMPTS[scenario]

  if (additionalContext) {
    prompt += `\n\n## Additional Context:\n${additionalContext}`
  }

  return prompt
}

/**
 * Detect scenario from user input and conversation history
 */
export function detectScenario(
  userInput: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  acceptedRecipesCount: number = 0
): keyof typeof SCENARIO_PROMPTS | 'default' {
  const input = userInput.toLowerCase()
  const fullConversation = conversationHistory.map(m => m.content).join(' ').toLowerCase()

  // Check for dietary restrictions
  const dietaryKeywords = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'allergy', 'can\'t eat', 'avoid']
  if (dietaryKeywords.some(keyword => input.includes(keyword) || fullConversation.includes(keyword))) {
    return 'dietaryRestrictions'
  }

  // Check for quick/easy meal requests
  const quickKeywords = ['quick', 'fast', 'easy', 'simple', 'busy', 'weeknight', '30 min', '20 min', 'no time']
  if (quickKeywords.some(keyword => input.includes(keyword))) {
    return 'quickMeals'
  }

  // Check for entertaining/guests
  const entertainingKeywords = ['guests', 'party', 'entertaining', 'dinner party', 'friends over', 'company', 'impress']
  if (entertainingKeywords.some(keyword => input.includes(keyword))) {
    return 'entertaining'
  }

  // Check for specific ingredients
  const ingredientKeywords = ['use up', 'have', 'leftover', 'need to use', 'with', 'using']
  const hasIngredientMention = ingredientKeywords.some(keyword => input.includes(keyword))
  if (hasIngredientMention && (input.includes('tomato') || input.includes('chicken') || input.includes('pasta'))) {
    return 'ingredientFocused'
  }

  // Check for cuisine exploration
  const cuisineKeywords = ['italian', 'asian', 'mexican', 'mediterranean', 'indian', 'thai', 'chinese', 'cuisine', 'try something']
  if (cuisineKeywords.some(keyword => input.includes(keyword))) {
    return 'cuisineExploration'
  }

  // Check for meal prep
  const mealPrepKeywords = ['meal prep', 'batch', 'make ahead', 'prep', 'freeze', 'store', 'week of meals']
  if (mealPrepKeywords.some(keyword => input.includes(keyword))) {
    return 'mealPrep'
  }

  // Check for family cooking
  const familyKeywords = ['family', 'kids', 'children', 'picky eater', 'kid-friendly', 'with my children']
  if (familyKeywords.some(keyword => input.includes(keyword))) {
    return 'familyCooking'
  }

  // Check for comfort food
  const comfortKeywords = ['comfort', 'cozy', 'warming', 'hearty', 'cold day', 'feeling down', 'soul food']
  if (comfortKeywords.some(keyword => input.includes(keyword))) {
    return 'comfortFood'
  }

  // Check for weekly planning (multiple meals or week mentions)
  const weeklyKeywords = ['week', 'weekly', 'several', 'multiple', 'plan ahead', '3 meals', '4 meals', '5 meals']
  const numberPattern = /\d+\s*(meals|recipes|dishes)/
  if (weeklyKeywords.some(keyword => input.includes(keyword)) || numberPattern.test(input) || acceptedRecipesCount >= 2) {
    return 'weeklyPlanning'
  }

  return 'default'
}

/**
 * Response templates for different scenarios
 */
export const RESPONSE_TEMPLATES = {
  recipeAccepted: [
    "Perfect choice! **{recipeName}** is now in your meal plan. {reason}",
    "Excellent! I've added **{recipeName}** to your plan. {reason}",
    "Great selection! **{recipeName}** is perfect for {context}. {reason}"
  ],
  
  recipeDeclined: [
    "No worries! Let me suggest something else that might work better.",
    "Understood! I'll find a different option that's more your style.",
    "No problem at all! Let me look for something that better fits what you're looking for."
  ],
  
  needMoreInfo: [
    "I'd love to help you find the perfect recipe! Could you tell me a bit more about {question}?",
    "To give you the best suggestions, I need to know more about {question}.",
    "Let me find exactly what you're looking for! Can you help me understand {question}?"
  ],
  
  noRecipesFound: [
    "I don't see any recipes in your collection that match those criteria. Would you like me to {suggestion}?",
    "Your collection doesn't have recipes matching those specific requirements. Should I {suggestion}?",
    "I couldn't find recipes that fit all those criteria. Let me {suggestion}."
  ]
}

/**
 * Generate contextual follow-up questions
 */
export function generateFollowUpQuestions(scenario: keyof typeof SCENARIO_PROMPTS | 'default'): string[] {
  const questions = {
    default: [
      "What type of meal are you planning?",
      "Any dietary restrictions I should know about?",
      "How much time do you have for cooking?"
    ],
    weeklyPlanning: [
      "How many meals would you like to plan?",
      "Which days of the week are you cooking?",
      "Do you prefer quick weeknight meals or have time for elaborate cooking?"
    ],
    dietaryRestrictions: [
      "Are there any other ingredients you need to avoid?",
      "Do you have any food allergies I should be aware of?",
      "Are you following this diet long-term or temporarily?"
    ],
    quickMeals: [
      "What's your maximum cooking time?",
      "Do you prefer one-pot meals or don't mind multiple dishes?",
      "Are you cooking just for yourself or others too?"
    ],
    entertaining: [
      "How many guests will you be serving?",
      "What's the occasion - casual or more formal?",
      "Do any of your guests have dietary restrictions?"
    ],
    ingredientFocused: [
      "What ingredients do you want to feature?",
      "How much of each ingredient do you have?",
      "Are you trying to use them up before they expire?"
    ],
    cuisineExploration: [
      "Which cuisine are you interested in trying?",
      "Are you a beginner with this type of cooking?",
      "Do you have the typical spices and ingredients for this cuisine?"
    ],
    mealPrep: [
      "How many days worth of meals do you want to prep?",
      "Do you prefer meals that freeze well or just refrigerate?",
      "Are you prepping complete meals or just components?"
    ],
    familyCooking: [
      "How many people are you cooking for?",
      "Are there any picky eaters in the family?",
      "Do you want recipes the kids can help make?"
    ],
    comfortFood: [
      "What type of comfort food are you craving?",
      "Are you looking for something hearty and filling?",
      "Any particular flavors that sound comforting right now?"
    ]
  }

  return questions[scenario] || questions.default
} 