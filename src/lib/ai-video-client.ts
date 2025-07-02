/**
 * AI Video Client
 * Specialized AI client for processing video transcriptions into structured recipes using Deepseek
 */

import { ParsedRecipe } from '@/types/comparison'

export interface VideoTranscriptionData {
  text: string
  duration?: number
  confidence?: number
  videoMetadata?: {
    title?: string
    description?: string
    uploader?: string
    platform?: string
    originalUrl?: string
    thumbnail?: string
  }
  audioMetadata?: {
    duration?: number
    sampleRate?: number
    format?: string
  }
}

export interface RecipeStructuringOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  includePartialResults?: boolean
  enhanceWithMetadata?: boolean
}

export interface RecipeStructuringResult {
  success: boolean
  recipe?: ParsedRecipe
  confidence?: number
  reasoning?: string
  partialResults?: {
    title?: string
    ingredients?: string[]
    instructions?: string[]
    summary?: string
  }
  error?: string
  warnings?: string[]
  processingTime?: number
  modelUsed?: string
}

export interface RecipeStructuringProgress {
  stage: 'analyzing' | 'structuring' | 'validating' | 'enhancing' | 'completed' | 'failed'
  progress?: number
  message?: string
  currentStep?: string
}

/**
 * Default configuration for recipe structuring
 */
const DEFAULT_CONFIG = {
  model: 'deepseek-r1:latest',
  temperature: 0.1, // Low temperature for consistent structuring
  maxTokens: 2000,
  timeout: 60000, // 1 minute timeout
  includePartialResults: true,
  enhanceWithMetadata: true,
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434'
}

/**
 * Structure video transcription into recipe format using Deepseek
 */
export async function structureVideoRecipe(
  transcriptionData: VideoTranscriptionData,
  options: RecipeStructuringOptions = {},
  onProgress?: (progress: RecipeStructuringProgress) => void
): Promise<RecipeStructuringResult> {
  const config = { ...DEFAULT_CONFIG, ...options }
  const warnings: string[] = []
  const startTime = Date.now()

  try {
    onProgress?.({ stage: 'analyzing', message: 'Analyzing transcription content...', progress: 10 })

    // Step 1: Validate input transcription
    const validation = validateTranscription(transcriptionData)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'Invalid transcription data',
        warnings,
        processingTime: Date.now() - startTime
      }
    }

    // Step 2: Check Deepseek model availability
    const modelCheck = await checkDeepseekModel(config.model)
    if (!modelCheck.available) {
      return {
        success: false,
        error: modelCheck.error || 'Deepseek model not available',
        warnings,
        processingTime: Date.now() - startTime
      }
    }

    // Step 3: Build context-aware prompt
    onProgress?.({ stage: 'structuring', message: 'Structuring recipe content...', progress: 30 })
    
    const prompt = buildRecipeStructuringPrompt(transcriptionData, config)
    
    // Step 4: Make request to Deepseek via Ollama
    const aiResponse = await callDeepseekAPI(prompt, config)
    
    if (!aiResponse.success) {
      return {
        success: false,
        error: aiResponse.error || 'AI processing failed',
        warnings: warnings.concat(aiResponse.warnings || []),
        processingTime: Date.now() - startTime
      }
    }

    onProgress?.({ stage: 'validating', message: 'Validating structured recipe...', progress: 70 })

    // Step 5: Parse and validate the AI response
    const parseResult = parseAIResponse(aiResponse.response!, transcriptionData)
    
    if (!parseResult.success) {
      // If parsing failed but we have partial results, return them
      if (config.includePartialResults && parseResult.partialResults) {
        warnings.push('Failed to parse complete recipe, returning partial results')
        
        return {
          success: false,
          error: parseResult.error,
          partialResults: parseResult.partialResults,
          warnings,
          processingTime: Date.now() - startTime,
          modelUsed: config.model
        }
      }
      
      return {
        success: false,
        error: parseResult.error || 'Failed to parse AI response',
        warnings,
        processingTime: Date.now() - startTime
      }
    }

    // Step 6: Enhance with metadata if requested
    let finalRecipe = parseResult.recipe!
    
    if (config.enhanceWithMetadata && transcriptionData.videoMetadata) {
      onProgress?.({ stage: 'enhancing', message: 'Enhancing with video metadata...', progress: 90 })
      finalRecipe = enhanceRecipeWithMetadata(finalRecipe, transcriptionData.videoMetadata)
    }

    // Step 7: Final validation and confidence calculation
    const confidence = calculateRecipeConfidence(finalRecipe, transcriptionData)
    
    onProgress?.({ stage: 'completed', message: 'Recipe structuring completed', progress: 100 })

    return {
      success: true,
      recipe: finalRecipe,
      confidence,
      reasoning: parseResult.reasoning,
      warnings,
      processingTime: Date.now() - startTime,
      modelUsed: config.model
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({ stage: 'failed', message: `Recipe structuring failed: ${errorMessage}` })

    return {
      success: false,
      error: `Recipe structuring failed: ${errorMessage}`,
      warnings,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Validate transcription data for recipe structuring
 */
function validateTranscription(data: VideoTranscriptionData): {
  isValid: boolean
  error?: string
} {
  if (!data.text || data.text.trim().length === 0) {
    return { isValid: false, error: 'Empty transcription text' }
  }

  if (data.text.length < 20) {
    return { isValid: false, error: 'Transcription too short for recipe extraction' }
  }

  if (data.text.length > 10000) {
    return { isValid: false, error: 'Transcription too long (max 10,000 characters)' }
  }

  // Check if text contains recipe-related keywords
  const recipeKeywords = [
    'ingredient', 'cook', 'bake', 'mix', 'add', 'cup', 'tablespoon', 'teaspoon',
    'minute', 'hour', 'oven', 'pan', 'bowl', 'recipe', 'make', 'prepare'
  ]
  
  const lowerText = data.text.toLowerCase()
  const hasRecipeKeywords = recipeKeywords.some(keyword => 
    lowerText.includes(keyword)
  )

  if (!hasRecipeKeywords) {
    return { isValid: false, error: 'Transcription does not appear to contain recipe content' }
  }

  return { isValid: true }
}

/**
 * Check if Deepseek model is available
 */
async function checkDeepseekModel(modelName: string): Promise<{
  available: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${DEFAULT_CONFIG.ollamaHost}/api/tags`)
    
    if (!response.ok) {
      return {
        available: false,
        error: `Ollama service not available: ${response.status}`
      }
    }

    const data = await response.json()
    const models = data.models || []
    
    const modelExists = models.some((model: any) => 
      model.name === modelName || 
      model.name.startsWith(modelName.split(':')[0])
    )

    if (!modelExists) {
      return {
        available: false,
        error: `Model ${modelName} not found. Available models: ${models.map((m: any) => m.name).join(', ')}`
      }
    }

    return { available: true }

  } catch (error) {
    return {
      available: false,
      error: `Failed to check Deepseek model: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Build comprehensive prompt for recipe structuring
 */
function buildRecipeStructuringPrompt(
  data: VideoTranscriptionData,
  config: Required<RecipeStructuringOptions> & typeof DEFAULT_CONFIG
): string {
  const contextInfo = []
  
  if (data.videoMetadata?.platform) {
    contextInfo.push(`Platform: ${data.videoMetadata.platform}`)
  }
  
  if (data.videoMetadata?.title) {
    contextInfo.push(`Video Title: ${data.videoMetadata.title}`)
  }
  
  if (data.duration) {
    contextInfo.push(`Audio Duration: ${Math.round(data.duration)}s`)
  }
  
  if (data.confidence) {
    contextInfo.push(`Transcription Confidence: ${Math.round(data.confidence * 100)}%`)
  }

  const contextSection = contextInfo.length > 0 
    ? `Context Information:\n${contextInfo.join('\n')}\n\n`
    : ''

  return `<think>
I need to analyze this video transcription and extract recipe information. Let me break this down:

1. First, I'll identify if this is actually recipe content
2. Then extract the key components: title, ingredients, instructions
3. Look for cooking times, servings, and other details
4. Structure everything into proper JSON format
5. Handle any unclear or missing information appropriately

The transcription might be informal speech, so I need to interpret cooking instructions that might be casually stated.
</think>

You are a culinary expert AI assistant specializing in extracting structured recipes from video transcriptions. Your task is to analyze the following transcription from a cooking video and extract a complete, well-structured recipe.

${contextSection}Transcription Text:
"${data.text}"

Instructions:
1. Carefully analyze the transcription to identify recipe components
2. Extract ingredients with quantities when mentioned
3. Structure cooking instructions in logical order
4. Infer reasonable details when information is implicit
5. Handle casual speech patterns and convert them to clear instructions
6. If some information is unclear or missing, make reasonable assumptions based on cooking knowledge

Please respond ONLY with a JSON object in this exact format:
{
  "title": "Recipe title (inferred from content or video title)",
  "summary": "Brief description of the dish",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["step 1", "step 2", ...],
  "cookingTime": minutes_as_number_or_null,
  "servings": servings_as_number_or_null,
  "difficulty": "easy|medium|hard|null",
  "cuisine": "cuisine_type_or_null",
  "tags": ["tag1", "tag2", ...],
  "confidence": confidence_score_0_to_1,
  "reasoning": "Brief explanation of extraction decisions and any assumptions made"
}

Requirements:
- Include ALL ingredients mentioned, even if quantities are unclear
- Convert casual instructions to clear, actionable steps
- Use standard cooking terminology
- If cooking time isn't explicitly stated, estimate based on the recipe type
- Add relevant tags based on cooking methods, ingredients, or cuisine
- Be generous with ingredient interpretation (e.g., "some salt" becomes "salt to taste")
- If the transcription doesn't contain a complete recipe, extract whatever information is available

Remember: This is from a video transcription, so the language may be conversational. Convert spoken instructions into clear, written recipe steps.`
}

/**
 * Call Deepseek API via Ollama
 */
async function callDeepseekAPI(
  prompt: string,
  config: Required<RecipeStructuringOptions> & typeof DEFAULT_CONFIG
): Promise<{
  success: boolean
  response?: string
  error?: string
  warnings?: string[]
}> {
  try {
    const response = await fetch(`${config.ollamaHost}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
          stop: ['</think>', '\n\n---', '\n\nHuman:'] // Stop tokens to prevent overgeneration
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    if (!result.response) {
      throw new Error('Empty response from Deepseek model')
    }

    return {
      success: true,
      response: result.response
    }

  } catch (error) {
    return {
      success: false,
      error: `Deepseek API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Parse AI response into structured recipe
 */
function parseAIResponse(
  response: string,
  originalData: VideoTranscriptionData
): {
  success: boolean
  recipe?: ParsedRecipe
  reasoning?: string
  partialResults?: {
    title?: string
    ingredients?: string[]
    instructions?: string[]
    summary?: string
  }
  error?: string
} {
  try {
    // Clean the response to extract JSON
    let cleanedResponse = response.trim()
    
    // Remove <think> blocks if present
    cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    
    // Find JSON content (look for opening brace)
    const jsonStart = cleanedResponse.indexOf('{')
    const jsonEnd = cleanedResponse.lastIndexOf('}')
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return {
        success: false,
        error: 'No JSON structure found in AI response'
      }
    }
    
    const jsonStr = cleanedResponse.slice(jsonStart, jsonEnd + 1)
    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (!parsed.title && !parsed.ingredients && !parsed.instructions) {
      return {
        success: false,
        error: 'AI response missing essential recipe components',
        partialResults: extractPartialResults(parsed)
      }
    }

    // Convert to ParsedRecipe format
    const recipe: ParsedRecipe = {
      title: parsed.title || 'Untitled Recipe',
      summary: parsed.summary || null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : null,
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : null,
      cookingTime: typeof parsed.cookingTime === 'number' ? parsed.cookingTime : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      difficulty: parsed.difficulty || null,
      cuisine: parsed.cuisine || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : null
    }

    // Validate the structured recipe
    if (!isValidRecipe(recipe)) {
      return {
        success: false,
        error: 'Structured recipe failed validation',
        partialResults: extractPartialResults(parsed)
      }
    }

    return {
      success: true,
      recipe,
      reasoning: parsed.reasoning || 'Recipe extracted from video transcription'
    }

  } catch (error) {
    // Try to extract partial results even if JSON parsing fails
    const partialResults = extractPartialResultsFromText(response)
    
    return {
      success: false,
      error: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      partialResults: partialResults.hasResults ? partialResults : undefined
    }
  }
}

/**
 * Extract partial results from parsed JSON
 */
function extractPartialResults(parsed: any): {
  title?: string
  ingredients?: string[]
  instructions?: string[]
  summary?: string
} {
  return {
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : undefined,
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions : undefined
  }
}

/**
 * Extract partial results from text when JSON parsing fails
 */
function extractPartialResultsFromText(text: string): {
  hasResults: boolean
  title?: string
  ingredients?: string[]
  instructions?: string[]
  summary?: string
} {
  const results: any = { hasResults: false }

  // Try to find title
  const titleMatch = text.match(/title['":\s]+([^"'\n,}]+)/i)
  if (titleMatch) {
    results.title = titleMatch[1].trim()
    results.hasResults = true
  }

  // Try to find ingredients list
  const ingredientsMatch = text.match(/ingredients['":\s]*\[([\s\S]*?)\]/i)
  if (ingredientsMatch) {
    try {
      const ingredientsList = JSON.parse(`[${ingredientsMatch[1]}]`)
      results.ingredients = ingredientsList
      results.hasResults = true
    } catch {
      // If JSON parsing fails, try simple comma separation
      const simpleIngredients = ingredientsMatch[1]
        .split(',')
        .map(ing => ing.replace(/['"]/g, '').trim())
        .filter(ing => ing.length > 0)
      
      if (simpleIngredients.length > 0) {
        results.ingredients = simpleIngredients
        results.hasResults = true
      }
    }
  }

  return results
}

/**
 * Validate if recipe has minimum required information
 */
function isValidRecipe(recipe: ParsedRecipe): boolean {
  // Must have title and at least ingredients OR instructions
  return Boolean(
    recipe.title && 
    recipe.title.trim().length > 0 &&
    (
      (recipe.ingredients && recipe.ingredients.length > 0) ||
      (recipe.instructions && recipe.instructions.length > 0)
    )
  )
}

/**
 * Enhance recipe with video metadata
 */
function enhanceRecipeWithMetadata(
  recipe: ParsedRecipe,
  metadata: VideoTranscriptionData['videoMetadata']
): ParsedRecipe {
  const enhanced = { ...recipe }

  // Use video title if recipe title is generic
  if (metadata?.title && enhanced.title &&
      (enhanced.title === 'Untitled Recipe' || enhanced.title.length < 10)) {
    const cleanTitle = metadata.title
      .replace(/\s*[-|•]\s*(Instagram|TikTok|YouTube).*$/i, '')
      .trim()
    
    if (cleanTitle.length > enhanced.title.length) {
      enhanced.title = cleanTitle
    }
  }

  // Add platform and creator information to tags
  const additionalTags: string[] = []
  
  if (metadata?.platform) {
    additionalTags.push(metadata.platform)
  }
  
  if (metadata?.uploader) {
    additionalTags.push(`by-${metadata.uploader.toLowerCase().replace(/\s+/g, '-')}`)
  }

  if (additionalTags.length > 0) {
    enhanced.tags = [...(enhanced.tags || []), ...additionalTags]
  }

  // Use video description for summary if summary is missing
  if (!enhanced.summary && metadata?.description) {
    const cleanDesc = metadata.description
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .trim()
      .substring(0, 200)
    
    if (cleanDesc.length > 20) {
      enhanced.summary = cleanDesc
    }
  }

  return enhanced
}

/**
 * Calculate confidence score for the structured recipe
 */
function calculateRecipeConfidence(
  recipe: ParsedRecipe,
  originalData: VideoTranscriptionData
): number {
  let confidence = 0.5 // Base confidence

  // Factors that increase confidence
  if (recipe.title && recipe.title !== 'Untitled Recipe') confidence += 0.1
  if (recipe.ingredients && recipe.ingredients.length > 2) confidence += 0.15
  if (recipe.instructions && recipe.instructions.length > 1) confidence += 0.15
  if (recipe.cookingTime && recipe.cookingTime > 0) confidence += 0.05
  if (recipe.servings && recipe.servings > 0) confidence += 0.05
  if (recipe.summary && recipe.summary.length > 20) confidence += 0.05

  // Factor in original transcription confidence
  if (originalData.confidence) {
    confidence = confidence * (0.3 + 0.7 * originalData.confidence)
  }

  // Factor in video quality indicators
  if (originalData.videoMetadata?.title) confidence += 0.05
  if (originalData.videoMetadata?.description) confidence += 0.03

  return Math.max(0, Math.min(1, confidence))
} 