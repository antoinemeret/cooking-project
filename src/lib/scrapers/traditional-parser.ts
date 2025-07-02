import * as cheerio from 'cheerio'
import { ParsedRecipe, ParsingResult, ParsingError } from '@/types/comparison'

/**
 * Decode HTML entities in text content
 * Handles common entities like &#039; (apostrophe), &quot; (quote), &amp; (ampersand), etc.
 */
function decodeHtmlEntities(text: string | null): string | null {
  if (!text) return null
  
  let decoded = text
  
  // Replace common HTML entities
  decoded = decoded.replace(/&amp;/g, '&')
  decoded = decoded.replace(/&lt;/g, '<')
  decoded = decoded.replace(/&gt;/g, '>')
  decoded = decoded.replace(/&quot;/g, '"')
  decoded = decoded.replace(/&#x27;/g, "'")
  decoded = decoded.replace(/&#x2F;/g, '/')
  decoded = decoded.replace(/&#039;/g, "'")
  decoded = decoded.replace(/&#39;/g, "'")
  decoded = decoded.replace(/&apos;/g, "'")
  decoded = decoded.replace(/&nbsp;/g, ' ')
  
  // Replace numeric entities (decimal)
  decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
    return String.fromCharCode(parseInt(num, 10))
  })
  
  // Replace numeric entities (hexadecimal)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })
  
  return decoded
}

// Logging utility for traditional parsing
class TraditionalParsingLogger {
  private context: string
  private startTime: number
  private logs: Array<{ level: string; message: string; timestamp: number; data?: any }> = []

  constructor(context: string) {
    this.context = context
    this.startTime = Date.now()
  }

  debug(message: string, data?: any) {
    this.logs.push({
      level: 'debug',
      message: `[${this.context}] ${message}`,
      timestamp: Date.now() - this.startTime,
      data
    })
    console.debug(`[Traditional Parser] ${message}`, data || '')
  }

  info(message: string, data?: any) {
    this.logs.push({
      level: 'info',
      message: `[${this.context}] ${message}`,
      timestamp: Date.now() - this.startTime,
      data
    })
    console.info(`[Traditional Parser] ${message}`, data || '')
  }

  warn(message: string, data?: any) {
    this.logs.push({
      level: 'warn',
      message: `[${this.context}] ${message}`,
      timestamp: Date.now() - this.startTime,
      data
    })
    console.warn(`[Traditional Parser] ${message}`, data || '')
  }

  error(message: string, error?: any) {
    this.logs.push({
      level: 'error',
      message: `[${this.context}] ${message}`,
      timestamp: Date.now() - this.startTime,
      data: error
    })
    console.error(`[Traditional Parser] ${message}`, error || '')
  }

  getLogs() {
    return this.logs
  }

  getExecutionTime() {
    return Date.now() - this.startTime
  }
}

// Enhanced error handling utilities
function createParsingError(
  code: ParsingError['code'],
  message: string,
  details?: any
): ParsingError {
  return {
    code,
    message,
    details
  }
}

function handleParsingException(error: unknown, context: string): ParsingError {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.name === 'SyntaxError') {
      return createParsingError('PARSING_FAILED', `JSON parsing failed in ${context}: ${error.message}`, {
        name: error.name,
        stack: error.stack
      })
    }
    
    if (error.message.includes('timeout')) {
      return createParsingError('TIMEOUT', `Parsing timeout in ${context}: ${error.message}`, {
        name: error.name,
        stack: error.stack
      })
    }
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return createParsingError('NETWORK_ERROR', `Network error in ${context}: ${error.message}`, {
        name: error.name,
        stack: error.stack
      })
    }
    
    return createParsingError('UNKNOWN_ERROR', `Unexpected error in ${context}: ${error.message}`, {
      name: error.name,
      stack: error.stack
    })
  }
  
  return createParsingError('UNKNOWN_ERROR', `Unknown error in ${context}`, { error })
}

/**
 * Main traditional parsing function with intelligent fallback logic
 * Tries JSON-LD first, then microdata, then HTML parsing as fallbacks
 */
export async function parseTraditional(html: string, url?: string): Promise<ParsingResult> {
  const logger = new TraditionalParsingLogger('parseTraditional')
  const attemptedMethods: string[] = []
  const errors: ParsingError[] = []
  
  logger.info('Starting traditional parsing', { 
    htmlLength: html.length,
    url: url || 'unknown',
    timestamp: new Date().toISOString()
  })
  
  try {
    // Validate input
    if (!html || html.trim().length === 0) {
      const error = createParsingError('INVALID_URL', 'Empty or invalid HTML content provided')
      logger.error('Invalid HTML input', error)
      return createFailedResult(error, logger, attemptedMethods, errors)
    }
    
    // First attempt: JSON-LD structured data (most reliable)
    logger.debug('Attempting JSON-LD parsing')
    attemptedMethods.push('json-ld')
    
    try {
      const jsonLdResult = await parseJsonLD(html)
      
      if (jsonLdResult.success && jsonLdResult.recipe) {
        logger.debug('JSON-LD parsing successful', {
          hasTitle: !!jsonLdResult.recipe.title,
          ingredientCount: jsonLdResult.recipe.ingredients?.length || 0,
          instructionCount: jsonLdResult.recipe.instructions?.length || 0
        })
        
        if (isRecipeDataMeaningful(jsonLdResult.recipe)) {
          logger.info('JSON-LD parsing completed successfully', {
            processingTime: logger.getExecutionTime(),
            dataQuality: 'meaningful'
          })
          
          return {
            ...jsonLdResult,
            processingTime: logger.getExecutionTime(),
            extractedRawData: {
              ...jsonLdResult.extractedRawData,
              attemptedMethods,
              primaryMethod: 'json-ld',
              logs: logger.getLogs()
            }
          }
        } else {
          logger.warn('JSON-LD data not meaningful, trying next method')
        }
      }
      
      if (jsonLdResult.error) {
        const error = createParsingError('PARSING_FAILED', jsonLdResult.error)
        errors.push(error)
        logger.warn('JSON-LD parsing failed', error)
      }
    } catch (error) {
      const parsingError = handleParsingException(error, 'JSON-LD')
      errors.push(parsingError)
      logger.error('JSON-LD parsing exception', parsingError)
    }
    
    // Second attempt: Microdata (good fallback)
    logger.debug('Attempting microdata parsing')
    attemptedMethods.push('microdata')
    
    try {
      const microdataResult = await parseMicrodata(html)
      
      if (microdataResult.success && microdataResult.recipe) {
        logger.debug('Microdata parsing successful', {
          hasTitle: !!microdataResult.recipe.title,
          ingredientCount: microdataResult.recipe.ingredients?.length || 0,
          instructionCount: microdataResult.recipe.instructions?.length || 0
        })
        
        if (isRecipeDataMeaningful(microdataResult.recipe)) {
          logger.info('Microdata parsing completed successfully', {
            processingTime: logger.getExecutionTime(),
            dataQuality: 'meaningful'
          })
          
          return {
            ...microdataResult,
            processingTime: logger.getExecutionTime(),
            extractedRawData: {
              ...microdataResult.extractedRawData,
              attemptedMethods,
              primaryMethod: 'microdata',
              logs: logger.getLogs()
            }
          }
        } else {
          logger.warn('Microdata data not meaningful, trying next method')
        }
      }
      
      if (microdataResult.error) {
        const error = createParsingError('PARSING_FAILED', microdataResult.error)
        errors.push(error)
        logger.warn('Microdata parsing failed', error)
      }
    } catch (error) {
      const parsingError = handleParsingException(error, 'microdata')
      errors.push(parsingError)
      logger.error('Microdata parsing exception', parsingError)
    }
    
    // Third attempt: HTML parsing (universal fallback)
    logger.debug('Attempting HTML pattern parsing')
    attemptedMethods.push('html-parsing')
    
    try {
      const htmlResult = await parseHTML(html)
      
      if (htmlResult.success && htmlResult.recipe) {
        logger.debug('HTML parsing successful', {
          hasTitle: !!htmlResult.recipe.title,
          ingredientCount: htmlResult.recipe.ingredients?.length || 0,
          instructionCount: htmlResult.recipe.instructions?.length || 0
        })
        
        if (isRecipeDataMeaningful(htmlResult.recipe)) {
          logger.info('HTML parsing completed successfully', {
            processingTime: logger.getExecutionTime(),
            dataQuality: 'meaningful'
          })
          
          return {
            ...htmlResult,
            processingTime: logger.getExecutionTime(),
            extractedRawData: {
              ...htmlResult.extractedRawData,
              attemptedMethods,
              primaryMethod: 'html-parsing',
              logs: logger.getLogs()
            }
          }
        } else {
          logger.warn('HTML parsing data not meaningful, trying hybrid approach')
        }
      }
      
      if (htmlResult.error) {
        const error = createParsingError('PARSING_FAILED', htmlResult.error)
        errors.push(error)
        logger.warn('HTML parsing failed', error)
      }
    } catch (error) {
      const parsingError = handleParsingException(error, 'HTML parsing')
      errors.push(parsingError)
      logger.error('HTML parsing exception', parsingError)
    }
    
    // If all methods failed or returned insufficient data, try hybrid approach
    logger.debug('Attempting hybrid parsing approach')
    attemptedMethods.push('hybrid')
    
    try {
      const hybridResult = await parseHybrid(html, [], logger)
      
      if (hybridResult.success && hybridResult.recipe) {
        logger.info('Hybrid parsing completed successfully', {
          processingTime: logger.getExecutionTime(),
          dataQuality: 'meaningful'
        })
        
        return {
          ...hybridResult,
          processingTime: logger.getExecutionTime(),
          extractedRawData: {
            ...hybridResult.extractedRawData,
            attemptedMethods,
            primaryMethod: 'hybrid',
            logs: logger.getLogs()
          }
        }
      }
    } catch (error) {
      const parsingError = handleParsingException(error, 'hybrid parsing')
      errors.push(parsingError)
      logger.error('Hybrid parsing exception', parsingError)
    }
    
    // All methods failed
    logger.error('All parsing methods failed', {
      attemptedMethods,
      errorCount: errors.length,
      processingTime: logger.getExecutionTime()
    })
    
    const combinedError = createParsingError(
      'PARSING_FAILED',
      `All parsing methods failed after ${attemptedMethods.length} attempts`,
      { 
        attemptedMethods,
        errors: errors.map(e => ({ code: e.code, message: e.message })),
        processingTime: logger.getExecutionTime()
      }
    )
    
    return createFailedResult(combinedError, logger, attemptedMethods, errors)
    
  } catch (error) {
    const parsingError = handleParsingException(error, 'traditional parsing orchestration')
    logger.error('Critical parsing error', parsingError)
    return createFailedResult(parsingError, logger, attemptedMethods, errors)
  }
}

/**
 * Helper function to create consistent failed parsing results
 */
function createFailedResult(
  error: ParsingError,
  logger: TraditionalParsingLogger,
  attemptedMethods: string[],
  errors: ParsingError[]
): ParsingResult {
  return {
    success: false,
    recipe: null,
    error: error.message,
    processingTime: logger.getExecutionTime(),
    parsingMethod: 'failed',
    extractedRawData: {
      attemptedMethods,
      errors: errors.map(e => ({ code: e.code, message: e.message })),
      logs: logger.getLogs(),
      primaryError: error
    }
  }
}

/**
 * Check if extracted recipe data contains meaningful information
 * Exported for use in other parts of the comparison system
 */
export function isRecipeDataMeaningful(recipe: ParsedRecipe): boolean {
  const hasTitle = Boolean(recipe.title && recipe.title.trim().length > 0)
  const hasIngredients = Boolean(recipe.ingredients && recipe.ingredients.length > 0)
  const hasInstructions = Boolean(recipe.instructions && recipe.instructions.length > 0)
  
  // Recipe is meaningful if it has a title AND (ingredients OR instructions)
  return hasTitle && (hasIngredients || hasInstructions)
}

/**
 * Hybrid parsing approach that combines results from multiple methods
 * Uses the best available data from each method to create a complete recipe
 */
async function parseHybrid(html: string, results: ParsingResult[], logger?: TraditionalParsingLogger): Promise<ParsingResult> {
  const recipes = results
    .filter(result => result.recipe !== null)
    .map(result => result.recipe!)
  
  if (recipes.length === 0) {
    return {
      success: false,
      recipe: null,
      error: 'No valid recipe data from any parsing method',
      processingTime: 0,
      parsingMethod: 'failed'
    }
  }
  
  // Combine the best data from all successful parsing attempts
  const hybridRecipe: ParsedRecipe = {
    title: selectBestField(recipes.map(r => r.title)),
    summary: selectBestField(recipes.map(r => r.summary)),
    instructions: selectBestArrayField(recipes.map(r => r.instructions)),
    ingredients: selectBestArrayField(recipes.map(r => r.ingredients)),
    cookingTime: selectBestNumericField(recipes.map(r => r.cookingTime)),
    servings: selectBestNumericField(recipes.map(r => r.servings)),
    difficulty: selectBestField(recipes.map(r => r.difficulty)),
    cuisine: selectBestField(recipes.map(r => r.cuisine)),
    tags: combineUniqueArrays(recipes.map(r => r.tags))
  }
  
  // Check if hybrid result is meaningful
  if (!isRecipeDataMeaningful(hybridRecipe)) {
    return {
      success: false,
      recipe: null,
      error: 'Hybrid parsing did not produce meaningful recipe data',
      processingTime: 0,
      parsingMethod: 'failed'
    }
  }
  
  return {
    success: true,
    recipe: hybridRecipe,
    error: null,
    processingTime: 0,
    parsingMethod: 'hybrid',
    extractedRawData: {
      sourceMethods: results.map(r => r.parsingMethod),
      combinedFields: Object.keys(hybridRecipe).filter(key => 
        hybridRecipe[key as keyof ParsedRecipe] !== null
      )
    }
  }
}

/**
 * Select the best text field from multiple options
 */
function selectBestField(fields: (string | null)[]): string | null {
  const validFields = fields.filter((field): field is string => field !== null && field.trim().length > 0)
  
  if (validFields.length === 0) return null
  
  // Prefer longer, more descriptive content
  return validFields.reduce((best, current) => 
    current.length > best.length ? current : best
  )
}

/**
 * Select the best array field from multiple options
 */
function selectBestArrayField(fields: (string[] | null)[]): string[] | null {
  const validFields = fields.filter((field): field is string[] => field !== null && field.length > 0)
  
  if (validFields.length === 0) return null
  
  // Prefer the array with the most items
  return validFields.reduce((best, current) => 
    current.length > best.length ? current : best
  )
}

/**
 * Select the best numeric field from multiple options
 */
function selectBestNumericField(fields: (number | null)[]): number | null {
  const validFields = fields.filter((field): field is number => field !== null && field > 0)
  
  if (validFields.length === 0) return null
  
  // For cooking time and servings, prefer reasonable middle values
  // This helps avoid outliers from parsing errors
  validFields.sort((a, b) => a - b)
  const middle = Math.floor(validFields.length / 2)
  
  return validFields.length % 2 === 0
    ? Math.round((validFields[middle - 1] + validFields[middle]) / 2)
    : validFields[middle]
}

/**
 * Combine arrays from multiple sources, removing duplicates
 */
function combineUniqueArrays(arrays: string[][]): string[] {
  const combined = arrays.flat().filter(item => item && item.trim().length > 0)
  return [...new Set(combined.map(item => item.trim().toLowerCase()))]
    .map(item => {
      // Find original casing
      const original = combined.find(orig => orig.toLowerCase() === item)
      return original || item
    })
}

/**
 * Parse JSON-LD structured data from HTML content
 * Looks for script[type="application/ld+json"] elements containing Recipe schema
 */
export async function parseJsonLD(html: string): Promise<ParsingResult> {
  const startTime = Date.now()
  
  try {
    const $ = cheerio.load(html)
    const jsonLdScripts = $('script[type="application/ld+json"]')
    
    if (jsonLdScripts.length === 0) {
      return {
        success: false,
        recipe: null,
        error: 'No JSON-LD structured data found',
        processingTime: Date.now() - startTime,
        parsingMethod: 'failed'
      }
    }
    
    // Try each JSON-LD script to find Recipe data
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const scriptContent = $(jsonLdScripts[i]).html()
      if (!scriptContent) continue
      
      try {
        const jsonData = JSON.parse(scriptContent)
        const recipe = extractRecipeFromJsonLD(jsonData)
        
        if (recipe) {
          return {
            success: true,
            recipe,
            error: null,
            processingTime: Date.now() - startTime,
            parsingMethod: 'json-ld',
            extractedRawData: jsonData
          }
        }
      } catch (parseError) {
        // Continue to next script if JSON parsing fails
        continue
      }
    }
    
    return {
      success: false,
      recipe: null,
      error: 'No Recipe schema found in JSON-LD data',
      processingTime: Date.now() - startTime,
      parsingMethod: 'failed'
    }
    
  } catch (error) {
    return {
      success: false,
      recipe: null,
      error: `JSON-LD parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime: Date.now() - startTime,
      parsingMethod: 'failed'
    }
  }
}

/**
 * Extract recipe data from JSON-LD object
 * Handles both single Recipe objects and arrays containing Recipe objects
 */
function extractRecipeFromJsonLD(jsonData: any): ParsedRecipe | null {
  // Handle arrays (common in JSON-LD)
  if (Array.isArray(jsonData)) {
    for (const item of jsonData) {
      const recipe = extractRecipeFromJsonLD(item)
      if (recipe) return recipe
    }
    return null
  }
  
  // Handle @graph structure
  if (jsonData['@graph']) {
    return extractRecipeFromJsonLD(jsonData['@graph'])
  }
  
  // Check if this is a Recipe type
  const type = jsonData['@type']
  if (!type) return null
  
  const isRecipe = Array.isArray(type) 
    ? type.includes('Recipe') 
    : type === 'Recipe'
    
  if (!isRecipe) return null
  
  // Extract recipe data according to schema.org Recipe specification
  const recipe: ParsedRecipe = {
    title: extractStringValue(jsonData.name),
    summary: extractStringValue(jsonData.description),
    instructions: extractInstructions(jsonData.recipeInstructions),
    ingredients: extractIngredients(jsonData.recipeIngredient),
    cookingTime: extractCookingTime(jsonData),
    servings: extractServings(jsonData.recipeYield || jsonData.yield),
    difficulty: extractStringValue(jsonData.difficulty),
    cuisine: extractStringValue(jsonData.recipeCuisine),
    tags: extractTags(jsonData)
  }
  
  return recipe
}

/**
 * Extract string value from various JSON-LD formats
 */
function extractStringValue(value: any): string | null {
  if (!value) return null
  
  if (typeof value === 'string') return decodeHtmlEntities(value.trim())
  
  // Handle structured text objects
  if (typeof value === 'object' && value.text) {
    return decodeHtmlEntities(value.text.trim())
  }
  
  // Handle arrays - take first non-empty string
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractStringValue(item)
      if (extracted) return extracted
    }
  }
  
  return null
}

/**
 * Extract cooking instructions from JSON-LD recipeInstructions
 */
function extractInstructions(instructions: any): string[] | null {
  if (!instructions) return null
  
  const result: string[] = []
  
  // Handle array of instructions
  if (Array.isArray(instructions)) {
    for (const instruction of instructions) {
      const text = extractInstructionText(instruction)
      if (text) result.push(text)
    }
  } else {
    const text = extractInstructionText(instructions)
    if (text) result.push(text)
  }
  
  return result.length > 0 ? result : null
}

/**
 * Extract text from a single instruction object
 */
function extractInstructionText(instruction: any): string | null {
  if (typeof instruction === 'string') {
    return decodeHtmlEntities(instruction.trim())
  }
  
  if (typeof instruction === 'object') {
    // HowToStep format
    if (instruction.text) return decodeHtmlEntities(instruction.text.trim())
    if (instruction.name) return decodeHtmlEntities(instruction.name.trim())
    
    // CreativeWork format
    if (instruction.description) return decodeHtmlEntities(instruction.description.trim())
  }
  
  return null
}

/**
 * Extract ingredients list from JSON-LD recipeIngredient
 */
function extractIngredients(ingredients: any): string[] | null {
  if (!ingredients) return null
  
  const result: string[] = []
  
  if (Array.isArray(ingredients)) {
    for (const ingredient of ingredients) {
      const text = extractStringValue(ingredient)
      if (text) result.push(text)
    }
  } else {
    const text = extractStringValue(ingredients)
    if (text) result.push(text)
  }
  
  return result.length > 0 ? result : null
}

/**
 * Extract cooking time from various time fields
 */
function extractCookingTime(jsonData: any): number | null {
  // Try different time fields in order of preference
  const timeFields = [
    'totalTime',
    'cookTime', 
    'cookingTime',
    'prepTime',
    'preparationTime'
  ]
  
  for (const field of timeFields) {
    const time = parseDuration(jsonData[field])
    if (time !== null) return time
  }
  
  return null
}

/**
 * Parse ISO 8601 duration or numeric minutes
 */
function parseDuration(duration: any): number | null {
  if (!duration) return null
  
  if (typeof duration === 'number') {
    return Math.round(duration)
  }
  
  if (typeof duration === 'string') {
    // Handle ISO 8601 duration format (PT30M, PT1H30M, etc.)
    const iso8601Match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    if (iso8601Match) {
      const hours = parseInt(iso8601Match[1] || '0', 10)
      const minutes = parseInt(iso8601Match[2] || '0', 10)
      return hours * 60 + minutes
    }
    
    // Handle simple numeric strings
    const numericMatch = duration.match(/(\d+)/)
    if (numericMatch) {
      return parseInt(numericMatch[1], 10)
    }
  }
  
  return null
}

/**
 * Extract serving information
 */
function extractServings(yield_: any): number | null {
  if (!yield_) return null
  
  if (typeof yield_ === 'number') {
    return Math.round(yield_)
  }
  
  if (typeof yield_ === 'string') {
    const match = yield_.match(/(\d+)/)
    if (match) {
      return parseInt(match[1], 10)
    }
  }
  
  // Handle arrays - take first numeric value
  if (Array.isArray(yield_)) {
    for (const item of yield_) {
      const servings = extractServings(item)
      if (servings !== null) return servings
    }
  }
  
  return null
}

/**
 * Extract tags from various JSON-LD fields
 */
function extractTags(jsonData: any): string[] {
  const tags: string[] = []
  
  // Common tag fields
  const tagFields = [
    'recipeCategory',
    'recipeCuisine', 
    'keywords',
    'suitableForDiet'
  ]
  
  for (const field of tagFields) {
    const fieldTags = extractTagsFromField(jsonData[field])
    tags.push(...fieldTags)
  }
  
  // Remove duplicates and filter out empty tags
  return [...new Set(tags.filter(tag => tag.trim().length > 0))]
}

/**
 * Extract tags from a specific field
 */
function extractTagsFromField(value: any): string[] {
  if (!value) return []
  
  const tags: string[] = []
  
  if (typeof value === 'string') {
    // Handle comma-separated tags
    const splitTags = value.split(',').map(tag => tag.trim())
    tags.push(...splitTags)
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const itemTags = extractTagsFromField(item)
      tags.push(...itemTags)
    }
  } else if (typeof value === 'object' && value.name) {
    tags.push(value.name.trim())
  }
  
  return tags
}

/**
 * Parse microdata structured data from HTML content
 * Looks for elements with itemtype="https://schema.org/Recipe" and extracts data via itemprop attributes
 */
export async function parseMicrodata(html: string): Promise<ParsingResult> {
  const startTime = Date.now()
  
  try {
    const $ = cheerio.load(html)
    
    // Look for Recipe microdata containers
    const recipeSelectors = [
      '[itemtype="https://schema.org/Recipe"]',
      '[itemtype="http://schema.org/Recipe"]',
      '[itemtype*="schema.org/Recipe"]'
    ]
    
    let recipeElement: any = null
    
    for (const selector of recipeSelectors) {
      const elements = $(selector)
      if (elements.length > 0) {
        recipeElement = elements.first()
        break
      }
    }
    
    if (!recipeElement || recipeElement.length === 0) {
      return {
        success: false,
        recipe: null,
        error: 'No Recipe microdata found',
        processingTime: Date.now() - startTime,
        parsingMethod: 'failed'
      }
    }
    
    const recipe = extractRecipeFromMicrodata($, recipeElement)
    
    return {
      success: true,
      recipe,
      error: null,
      processingTime: Date.now() - startTime,
      parsingMethod: 'microdata',
      extractedRawData: {
        html: recipeElement.html(),
        selector: recipeElement.get(0)?.tagName
      }
    }
    
  } catch (error) {
    return {
      success: false,
      recipe: null,
      error: `Microdata parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime: Date.now() - startTime,
      parsingMethod: 'failed'
    }
  }
}

/**
 * Extract recipe data from microdata element
 */
function extractRecipeFromMicrodata($: any, recipeElement: any): ParsedRecipe {
  const recipe: ParsedRecipe = {
    title: extractMicrodataProperty($, recipeElement, 'name'),
    summary: extractMicrodataProperty($, recipeElement, 'description'),
    instructions: extractMicrodataInstructions($, recipeElement),
    ingredients: extractMicrodataIngredients($, recipeElement),
    cookingTime: extractMicrodataCookingTime($, recipeElement),
    servings: extractMicrodataServings($, recipeElement),
    difficulty: extractMicrodataProperty($, recipeElement, 'difficulty'),
    cuisine: extractMicrodataProperty($, recipeElement, 'recipeCuisine'),
    tags: extractMicrodataTags($, recipeElement)
  }
  
  return recipe
}

/**
 * Extract a simple text property from microdata
 */
function extractMicrodataProperty($: any, container: any, property: string): string | null {
  // Look for elements with itemprop attribute
  const elements = container.find(`[itemprop="${property}"]`)
  
  if (elements.length === 0) return null
  
  const firstElement = elements.first()
  
  // Check for content attribute first (meta tags)
  const contentAttr = firstElement.attr('content')
  if (contentAttr) return decodeHtmlEntities(contentAttr.trim())
  
  // Check for value attribute (input elements)
  const valueAttr = firstElement.attr('value')
  if (valueAttr) return decodeHtmlEntities(valueAttr.trim())
  
  // Get text content
  const textContent = firstElement.text().trim()
  if (textContent) return decodeHtmlEntities(textContent)
  
  return null
}

/**
 * Extract multiple text values from microdata
 */
function extractMicrodataArray($: any, container: any, property: string): string[] {
  const elements = container.find(`[itemprop="${property}"]`)
  const results: string[] = []
  
  elements.each((_: any, element: any) => {
    const $element = $(element)
    
    // Check for content attribute first
    const contentAttr = $element.attr('content')
    if (contentAttr) {
      const decoded = decodeHtmlEntities(contentAttr.trim())
      if (decoded) results.push(decoded)
      return
    }
    
    // Check for value attribute
    const valueAttr = $element.attr('value')
    if (valueAttr) {
      const decoded = decodeHtmlEntities(valueAttr.trim())
      if (decoded) results.push(decoded)
      return
    }
    
    // Get text content
    const textContent = $element.text().trim()
    if (textContent) {
      const decoded = decodeHtmlEntities(textContent)
      if (decoded) results.push(decoded)
    }
  })
  
  return results.filter(item => item.length > 0)
}

/**
 * Extract cooking instructions from microdata
 */
function extractMicrodataInstructions($: any, container: any): string[] | null {
  // Try different instruction properties
  const instructionProperties = [
    'recipeInstructions',
    'instructions',
    'recipeInstruction'
  ]
  
  for (const property of instructionProperties) {
    const instructions = extractMicrodataArray($, container, property)
    if (instructions.length > 0) {
      return instructions
    }
  }
  
  // Look for nested HowToStep elements
  const howToSteps = container.find('[itemtype*="HowToStep"]')
  if (howToSteps.length > 0) {
    const steps: string[] = []
    
    howToSteps.each((_: any, element: any) => {
      const $step = $(element)
      const stepText = extractMicrodataProperty($, $step, 'text') || 
                     extractMicrodataProperty($, $step, 'name') ||
                     $step.text().trim()
      
      if (stepText) {
        steps.push(stepText)
      }
    })
    
    return steps.length > 0 ? steps : null
  }
  
  return null
}

/**
 * Extract ingredients from microdata
 */
function extractMicrodataIngredients($: any, container: any): string[] | null {
  // Try different ingredient properties
  const ingredientProperties = [
    'recipeIngredient',
    'ingredients',
    'ingredient'
  ]
  
  for (const property of ingredientProperties) {
    const ingredients = extractMicrodataArray($, container, property)
    if (ingredients.length > 0) {
      return ingredients
    }
  }
  
  return null
}

/**
 * Extract cooking time from microdata
 */
function extractMicrodataCookingTime($: any, container: any): number | null {
  // Try different time properties
  const timeProperties = [
    'totalTime',
    'cookTime',
    'cookingTime',
    'prepTime',
    'preparationTime'
  ]
  
  for (const property of timeProperties) {
    const timeValue = extractMicrodataProperty($, container, property)
    if (timeValue) {
      const parsedTime = parseDuration(timeValue)
      if (parsedTime !== null) return parsedTime
    }
  }
  
  return null
}

/**
 * Extract servings from microdata
 */
function extractMicrodataServings($: any, container: any): number | null {
  // Try different yield properties
  const yieldProperties = [
    'recipeYield',
    'yield',
    'serves',
    'servings'
  ]
  
  for (const property of yieldProperties) {
    const yieldValue = extractMicrodataProperty($, container, property)
    if (yieldValue) {
      const parsedYield = extractServings(yieldValue)
      if (parsedYield !== null) return parsedYield
    }
  }
  
  return null
}

/**
 * Extract tags from microdata
 */
function extractMicrodataTags($: any, container: any): string[] {
  const tags: string[] = []
  
  // Common tag properties
  const tagProperties = [
    'recipeCategory',
    'recipeCuisine',
    'keywords',
    'suitableForDiet'
  ]
  
  for (const property of tagProperties) {
    const propertyTags = extractMicrodataArray($, container, property)
    tags.push(...propertyTags)
  }
  
  // Handle comma-separated keywords
  const flattenedTags: string[] = []
  for (const tag of tags) {
    if (tag.includes(',')) {
      const splitTags = tag.split(',').map(t => t.trim())
      flattenedTags.push(...splitTags)
    } else {
      flattenedTags.push(tag)
    }
  }
  
  // Remove duplicates and filter out empty tags
  return [...new Set(flattenedTags.filter(tag => tag.length > 0))]
}

/**
 * Parse HTML content using custom rules for common recipe website patterns
 * This is a fallback when neither JSON-LD nor microdata are available
 */
export async function parseHTML(html: string): Promise<ParsingResult> {
  const startTime = Date.now()
  
  try {
    const $ = cheerio.load(html)
    
    const recipe = extractRecipeFromHTML($)
    
    // Check if we extracted meaningful data
    const hasData = recipe.title || 
                   (recipe.ingredients && recipe.ingredients.length > 0) ||
                   (recipe.instructions && recipe.instructions.length > 0)
    
    if (!hasData) {
      return {
        success: false,
        recipe: null,
        error: 'No recipe data found using HTML parsing patterns',
        processingTime: Date.now() - startTime,
        parsingMethod: 'failed'
      }
    }
    
    return {
      success: true,
      recipe,
      error: null,
      processingTime: Date.now() - startTime,
      parsingMethod: 'html-parsing',
      extractedRawData: {
        title: recipe.title,
        ingredientCount: recipe.ingredients?.length || 0,
        instructionCount: recipe.instructions?.length || 0
      }
    }
    
  } catch (error) {
    return {
      success: false,
      recipe: null,
      error: `HTML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime: Date.now() - startTime,
      parsingMethod: 'failed'
    }
  }
}

/**
 * Extract recipe data from HTML using common patterns
 */
function extractRecipeFromHTML($: any): ParsedRecipe {
  const recipe: ParsedRecipe = {
    title: extractHTMLTitle($),
    summary: extractHTMLSummary($),
    instructions: extractHTMLInstructions($),
    ingredients: extractHTMLIngredients($),
    cookingTime: extractHTMLCookingTime($),
    servings: extractHTMLServings($),
    difficulty: extractHTMLDifficulty($),
    cuisine: extractHTMLCuisine($),
    tags: extractHTMLTags($)
  }
  
  return recipe
}

/**
 * Extract recipe title using common HTML patterns
 */
function extractHTMLTitle($: any): string | null {
  const selectors = [
    'h1.recipe-title',
    'h1.entry-title',
    'h1[class*="recipe"]',
    'h1[class*="title"]',
    '.recipe-header h1',
    '.recipe-title',
    '.entry-title',
    'h1.post-title',
    'h1',
    'title'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim()
      if (text && text.length < 200) { // Reasonable title length
        return decodeHtmlEntities(text)
      }
    }
  }
  
  return null
}

/**
 * Extract recipe summary/description using common HTML patterns
 */
function extractHTMLSummary($: any): string | null {
  const selectors = [
    '.recipe-summary',
    '.recipe-description',
    '.entry-summary',
    '.recipe-intro',
    '[class*="description"]',
    'meta[name="description"]',
    'meta[property="og:description"]'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      // Handle meta tags
      if (element.is('meta')) {
        const content = element.attr('content')
        if (content && content.trim().length > 0) {
          return decodeHtmlEntities(content.trim())
        }
      } else {
        const text = element.text().trim()
        if (text && text.length > 20 && text.length < 500) { // Reasonable summary length
          return decodeHtmlEntities(text)
        }
      }
    }
  }
  
  return null
}

/**
 * Extract cooking instructions using common HTML patterns
 */
function extractHTMLInstructions($: any): string[] | null {
  const selectors = [
    '.recipe-instructions li',
    '.instructions li',
    '.recipe-method li',
    '.directions li',
    '.recipe-directions li',
    '[class*="instruction"] li',
    '[class*="direction"] li',
    '.recipe-instructions p',
    '.instructions p',
    '.recipe-method p',
    '.directions p'
  ]
  
  for (const selector of selectors) {
    const elements = $(selector)
    if (elements.length > 0) {
      const instructions: string[] = []
      
      elements.each((_: any, element: any) => {
        const text = $(element).text().trim()
        if (text && text.length > 10) { // Filter out very short instructions
          const decoded = decodeHtmlEntities(text)
          if (decoded) instructions.push(decoded)
        }
      })
      
      if (instructions.length > 0) {
        return instructions
      }
    }
  }
  
  // Try alternative patterns for instructions in divs or spans
  const altSelectors = [
    '.recipe-instructions .instruction',
    '.instructions .step',
    '.recipe-method .step',
    '[class*="instruction"][class*="step"]'
  ]
  
  for (const selector of altSelectors) {
    const elements = $(selector)
    if (elements.length > 0) {
      const instructions: string[] = []
      
      elements.each((_: any, element: any) => {
        const text = $(element).text().trim()
        if (text && text.length > 10) {
          const decoded = decodeHtmlEntities(text)
          if (decoded) instructions.push(decoded)
        }
      })
      
      if (instructions.length > 0) {
        return instructions
      }
    }
  }
  
  return null
}

/**
 * Extract ingredients using common HTML patterns
 */
function extractHTMLIngredients($: any): string[] | null {
  const selectors = [
    '.recipe-ingredients li',
    '.ingredients li',
    '.recipe-ingredient li',
    '[class*="ingredient"] li',
    '.recipe-ingredients p',
    '.ingredients p'
  ]
  
  for (const selector of selectors) {
    const elements = $(selector)
    if (elements.length > 0) {
      const ingredients: string[] = []
      
      elements.each((_: any, element: any) => {
        const text = $(element).text().trim()
        if (text && text.length > 2) { // Filter out very short ingredients
          const decoded = decodeHtmlEntities(text)
          if (decoded) ingredients.push(decoded)
        }
      })
      
      if (ingredients.length > 0) {
        return ingredients
      }
    }
  }
  
  // Try alternative patterns
  const altSelectors = [
    '.recipe-ingredients .ingredient',
    '.ingredients .ingredient',
    '[class*="ingredient"]:not(li):not(p)'
  ]
  
  for (const selector of altSelectors) {
    const elements = $(selector)
    if (elements.length > 0) {
      const ingredients: string[] = []
      
      elements.each((_: any, element: any) => {
        const text = $(element).text().trim()
        if (text && text.length > 2) {
          const decoded = decodeHtmlEntities(text)
          if (decoded) ingredients.push(decoded)
        }
      })
      
      if (ingredients.length > 0) {
        return ingredients
      }
    }
  }
  
  return null
}

/**
 * Extract cooking time using common HTML patterns and text analysis
 */
function extractHTMLCookingTime($: any): number | null {
  const selectors = [
    '.recipe-time',
    '.cook-time',
    '.cooking-time',
    '.prep-time',
    '.total-time',
    '[class*="time"]',
    '.recipe-meta .time',
    '.recipe-details .time'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim()
      const time = extractTimeFromText(text)
      if (time !== null) return time
    }
  }
  
  // Search for time patterns in general text
  const timePatterns = [
    /(\d+)\s*(?:hours?|hrs?|h)\s*(?:(\d+)\s*(?:minutes?|mins?|m))?/i,
    /(\d+)\s*(?:minutes?|mins?|m)/i,
    /(\d+)\s*(?:hours?|hrs?|h)/i,
    /prep.*?(\d+).*?(?:minutes?|mins?|m)/i,
    /cook.*?(\d+).*?(?:minutes?|mins?|m)/i,
    /total.*?(\d+).*?(?:minutes?|mins?|m)/i
  ]
  
  const bodyText = $('body').text()
  for (const pattern of timePatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      const hours = parseInt(match[1] || '0', 10)
      const minutes = parseInt(match[2] || match[1] || '0', 10)
      
      if (pattern.source.includes('hours?|hrs?|h')) {
        return hours * 60 + (match[2] ? minutes : 0)
      } else {
        return minutes
      }
    }
  }
  
  return null
}

/**
 * Extract time from text string
 */
function extractTimeFromText(text: string): number | null {
  const timePatterns = [
    /(\d+)\s*(?:hours?|hrs?|h)\s*(?:(\d+)\s*(?:minutes?|mins?|m))?/i,
    /(\d+)\s*(?:minutes?|mins?|m)/i,
    /(\d+)\s*(?:hours?|hrs?|h)/i
  ]
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (match) {
      const hours = parseInt(match[1] || '0', 10)
      const minutes = parseInt(match[2] || '0', 10)
      
      if (pattern.source.includes('hours?|hrs?|h')) {
        return hours * 60 + minutes
      } else {
        return hours // This is actually minutes in the minutes-only pattern
      }
    }
  }
  
  return null
}

/**
 * Extract servings using common HTML patterns
 */
function extractHTMLServings($: any): number | null {
  const selectors = [
    '.recipe-servings',
    '.servings',
    '.serves',
    '.recipe-yield',
    '.yield',
    '[class*="serving"]',
    '[class*="yield"]'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim()
      const servings = extractNumberFromText(text)
      if (servings !== null && servings > 0 && servings < 100) {
        return servings
      }
    }
  }
  
  // Search for serving patterns in general text
  const servingPatterns = [
    /serves?\s*(\d+)/i,
    /(\d+)\s*servings?/i,
    /makes?\s*(\d+)/i,
    /yield\s*(\d+)/i
  ]
  
  const bodyText = $('body').text()
  for (const pattern of servingPatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      const servings = parseInt(match[1], 10)
      if (servings > 0 && servings < 100) {
        return servings
      }
    }
  }
  
  return null
}

/**
 * Extract difficulty level using common HTML patterns
 */
function extractHTMLDifficulty($: any): string | null {
  const selectors = [
    '.recipe-difficulty',
    '.difficulty',
    '.recipe-level',
    '[class*="difficulty"]',
    '[class*="level"]'
  ]
  
  const difficultyLevels = ['easy', 'medium', 'hard', 'beginner', 'intermediate', 'advanced']
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim().toLowerCase()
      const decoded = decodeHtmlEntities(text)
      if (decoded) {
        const foundLevel = difficultyLevels.find(level => decoded.includes(level))
        if (foundLevel) return foundLevel
      }
    }
  }
  
  return null
}

/**
 * Extract cuisine type using common HTML patterns
 */
function extractHTMLCuisine($: any): string | null {
  const selectors = [
    '.recipe-cuisine',
    '.cuisine',
    '.recipe-category',
    '[class*="cuisine"]',
    '[class*="category"]'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim()
      if (text && text.length < 50) { // Reasonable cuisine length
        return decodeHtmlEntities(text)
      }
    }
  }
  
  return null
}

/**
 * Extract tags using common HTML patterns
 */
function extractHTMLTags($: any): string[] {
  const tags: string[] = []
  
  const selectors = [
    '.recipe-tags a',
    '.tags a',
    '.recipe-categories a',
    '.categories a',
    '[class*="tag"] a',
    '[class*="category"] a'
  ]
  
  for (const selector of selectors) {
    const elements = $(selector)
    elements.each((_: any, element: any) => {
      const text = $(element).text().trim()
      if (text && text.length < 30) { // Reasonable tag length
        const decoded = decodeHtmlEntities(text)
        if (decoded) tags.push(decoded)
      }
    })
  }
  
  // Remove duplicates and filter out empty tags
  return [...new Set(tags.filter(tag => tag.length > 0))]
}

/**
 * Extract number from text string
 */
function extractNumberFromText(text: string): number | null {
  const match = text.match(/(\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * Extract video metadata from HTML using Open Graph, Twitter Cards, and platform-specific meta tags
 * Specifically designed for Instagram, TikTok, and YouTube video pages
 */
export interface VideoMetadata {
  title?: string
  description?: string
  duration?: number
  thumbnail?: string
  uploader?: string
  uploadDate?: string
  platform?: string
  videoId?: string
  tags?: string[]
  isRecipe?: boolean
  recipeIngredients?: string[]
}

export async function extractVideoMetadata(html: string, url?: string): Promise<{
  success: boolean
  metadata?: VideoMetadata
  error?: string
}> {
  const logger = new TraditionalParsingLogger('extractVideoMetadata')
  
  try {
    if (!html || html.trim().length === 0) {
      return {
        success: false,
        error: 'Empty HTML content provided'
      }
    }

    const $ = cheerio.load(html)
    const metadata: VideoMetadata = {}

    // Extract Open Graph metadata
    const ogData = extractOpenGraphData($)
    Object.assign(metadata, ogData)

    // Extract Twitter Card metadata
    const twitterData = extractTwitterCardData($)
    Object.assign(metadata, twitterData)

    // Extract JSON-LD structured data for videos
    const jsonLdData = extractVideoJsonLD($)
    Object.assign(metadata, jsonLdData)

    // Platform-specific extraction
    if (url) {
      const platformData = extractPlatformSpecificData($, url)
      Object.assign(metadata, platformData)
    }

    // Extract potential recipe content from description
    if (metadata.description) {
      const recipeData = extractRecipeFromDescription(metadata.description)
      Object.assign(metadata, recipeData)
    }

    // Clean and normalize the extracted data
    const cleanedMetadata = cleanVideoMetadata(metadata)

    logger.info('Video metadata extraction completed', {
      hasTitle: !!cleanedMetadata.title,
      hasDescription: !!cleanedMetadata.description,
      hasThumbnail: !!cleanedMetadata.thumbnail,
      platform: cleanedMetadata.platform,
      isRecipe: cleanedMetadata.isRecipe
    })

    return {
      success: true,
      metadata: cleanedMetadata
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Video metadata extraction failed', error)
    
    return {
      success: false,
      error: `Video metadata extraction failed: ${errorMessage}`
    }
  }
}

/**
 * Extract Open Graph metadata
 */
function extractOpenGraphData($: ReturnType<typeof cheerio.load>): Partial<VideoMetadata> {
  const metadata: Partial<VideoMetadata> = {}

  // Title
  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle) {
    const decoded = decodeHtmlEntities(ogTitle)
    if (decoded) metadata.title = decoded
  }

  // Description
  const ogDescription = $('meta[property="og:description"]').attr('content')
  if (ogDescription) {
    const decoded = decodeHtmlEntities(ogDescription)
    if (decoded) metadata.description = decoded
  }

  // Image/Thumbnail
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) metadata.thumbnail = ogImage

  // Video duration (if available)
  const ogVideoDuration = $('meta[property="og:video:duration"]').attr('content')
  if (ogVideoDuration) {
    const duration = parseInt(ogVideoDuration, 10)
    if (!isNaN(duration)) metadata.duration = duration
  }

  // Video type to determine if it's a video
  const ogType = $('meta[property="og:type"]').attr('content')
  if (ogType === 'video' || ogType === 'video.other') {
    // This is definitely a video
  }

  return metadata
}

/**
 * Extract Twitter Card metadata
 */
function extractTwitterCardData($: ReturnType<typeof cheerio.load>): Partial<VideoMetadata> {
  const metadata: Partial<VideoMetadata> = {}

  // Title
  const twitterTitle = $('meta[name="twitter:title"]').attr('content')
  if (twitterTitle && !metadata.title) {
    const decoded = decodeHtmlEntities(twitterTitle)
    if (decoded) metadata.title = decoded
  }

  // Description
  const twitterDescription = $('meta[name="twitter:description"]').attr('content')
  if (twitterDescription && !metadata.description) {
    const decoded = decodeHtmlEntities(twitterDescription)
    if (decoded) metadata.description = decoded
  }

  // Image
  const twitterImage = $('meta[name="twitter:image"]').attr('content')
  if (twitterImage && !metadata.thumbnail) {
    metadata.thumbnail = twitterImage
  }

  // Player URL (for embedded videos)
  const twitterPlayer = $('meta[name="twitter:player"]').attr('content')
  if (twitterPlayer) {
    // Extract video ID from player URL if possible
    const videoId = extractVideoIdFromUrl(twitterPlayer)
    if (videoId) metadata.videoId = videoId
  }

  return metadata
}

/**
 * Extract video-specific JSON-LD structured data
 */
function extractVideoJsonLD($: ReturnType<typeof cheerio.load>): Partial<VideoMetadata> {
  const metadata: Partial<VideoMetadata> = {}

  try {
    $('script[type="application/ld+json"]').each((_, element) => {
      const jsonText = $(element).html()
      if (!jsonText) return

      try {
        const jsonData = JSON.parse(jsonText)
        
        // Handle array of structured data
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData]
        
        for (const data of dataArray) {
          if (data['@type'] === 'VideoObject') {
                         // Video-specific structured data
             if (data.name && !metadata.title) {
               const decoded = decodeHtmlEntities(data.name)
               if (decoded) metadata.title = decoded
             }
             
             if (data.description && !metadata.description) {
               const decoded = decodeHtmlEntities(data.description)
               if (decoded) metadata.description = decoded
             }
            
            if (data.thumbnailUrl && !metadata.thumbnail) {
              metadata.thumbnail = Array.isArray(data.thumbnailUrl) 
                ? data.thumbnailUrl[0] 
                : data.thumbnailUrl
            }
            
            if (data.duration && !metadata.duration) {
              const duration = parseDuration(data.duration)
              if (duration) metadata.duration = duration
            }
            
            if (data.uploadDate && !metadata.uploadDate) {
              metadata.uploadDate = data.uploadDate
            }

            // Extract uploader information
            if (data.author && !metadata.uploader) {
              metadata.uploader = typeof data.author === 'string' 
                ? data.author 
                : data.author.name || data.author['@name']
            }
          }
        }
      } catch (parseError) {
        // Continue with other script tags if one fails
        console.warn('Failed to parse JSON-LD:', parseError)
      }
    })
  } catch (error) {
    console.warn('Error extracting JSON-LD video data:', error)
  }

  return metadata
}

/**
 * Extract platform-specific metadata based on the URL
 */
function extractPlatformSpecificData($: ReturnType<typeof cheerio.load>, url: string): Partial<VideoMetadata> {
  const metadata: Partial<VideoMetadata> = {}

  if (url.includes('instagram.com')) {
    metadata.platform = 'instagram'
    
    // Instagram-specific selectors
    const instagramTitle = $('meta[property="og:title"]').attr('content')
    if (instagramTitle) {
      // Remove Instagram branding from title
      metadata.title = instagramTitle.replace(/\s*•\s*Instagram$/, '').trim()
    }

    // Extract video ID from URL
    const videoId = extractVideoIdFromUrl(url)
    if (videoId) metadata.videoId = videoId

  } else if (url.includes('tiktok.com')) {
    metadata.platform = 'tiktok'
    
    // TikTok-specific selectors
    const tiktokTitle = $('meta[property="og:title"]').attr('content')
    if (tiktokTitle) {
      // Clean TikTok title
      metadata.title = tiktokTitle.replace(/\s*\|\s*TikTok$/, '').trim()
    }

    // Extract uploader from TikTok page
    const tiktokUploader = $('meta[name="twitter:title"]').attr('content')
    if (tiktokUploader && tiktokUploader.includes('(@')) {
      const match = tiktokUploader.match(/\(@([^)]+)\)/)
      if (match) metadata.uploader = match[1]
    }

    // Extract video ID from URL
    const videoId = extractVideoIdFromUrl(url)
    if (videoId) metadata.videoId = videoId

  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    metadata.platform = 'youtube'
    
    // YouTube-specific selectors
    const youtubeTitle = $('meta[property="og:title"]').attr('content')
    if (youtubeTitle) {
      metadata.title = youtubeTitle
    }

    // Extract channel name
    const channelName = $('meta[property="og:video:tag"]').attr('content')
    if (channelName && !metadata.uploader) {
      metadata.uploader = channelName
    }

    // Extract video ID from URL
    const videoId = extractVideoIdFromUrl(url)
    if (videoId) metadata.videoId = videoId
  }

  return metadata
}

/**
 * Extract video ID from various URL formats
 */
function extractVideoIdFromUrl(url: string): string | null {
  // Instagram
  let match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/)
  if (match) return match[1]

  // TikTok
  match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (match) return match[1]

  match = url.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/)
  if (match) return match[1]

  // YouTube
  match = url.match(/(?:youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (match) return match[1]

  return null
}

/**
 * Extract recipe-related information from video description
 */
function extractRecipeFromDescription(description: string): Partial<VideoMetadata> {
  const metadata: Partial<VideoMetadata> = {}
  
  // Check if description contains recipe-related keywords
  const recipeKeywords = [
    'recipe', 'ingredients', 'cooking', 'baking', 'cook', 'bake',
    'kitchen', 'chef', 'food', 'dish', 'meal', 'make', 'prepare',
    'cups?', 'tbsp', 'tsp', 'tablespoons?', 'teaspoons?', 'grams?', 'kg',
    'minutes?', 'hours?', 'degrees?', 'oven', 'pan', 'mix', 'stir'
  ]
  
  const lowerDescription = description.toLowerCase()
  const hasRecipeKeywords = recipeKeywords.some(keyword => 
    new RegExp(`\\b${keyword}\\b`).test(lowerDescription)
  )
  
  metadata.isRecipe = hasRecipeKeywords

  if (hasRecipeKeywords) {
    // Try to extract ingredients from the description
    const ingredients = extractIngredientsFromDescription(description)
    if (ingredients.length > 0) {
      metadata.recipeIngredients = ingredients
    }

    // Extract hashtags that might be recipe-related
    const hashtags = description.match(/#[\w]+/g) || []
    const recipeTags = hashtags
      .map(tag => tag.substring(1).toLowerCase())
      .filter(tag => 
        recipeKeywords.some(keyword => tag.includes(keyword)) ||
        ['food', 'cooking', 'recipe', 'kitchen', 'chef', 'homemade'].includes(tag)
      )
    
    if (recipeTags.length > 0) {
      metadata.tags = recipeTags
    }
  }

  return metadata
}

/**
 * Clean and normalize video metadata
 */
function cleanVideoMetadata(metadata: VideoMetadata): VideoMetadata {
  const cleaned: VideoMetadata = {}

  // Clean title
  if (metadata.title) {
    cleaned.title = metadata.title
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .substring(0, 200) // Limit title length
  }

  // Clean description
  if (metadata.description) {
    cleaned.description = metadata.description
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .substring(0, 1000) // Limit description length
  }

  // Preserve other fields
  if (metadata.duration) cleaned.duration = metadata.duration
  if (metadata.thumbnail) cleaned.thumbnail = metadata.thumbnail
  if (metadata.uploader) cleaned.uploader = metadata.uploader?.trim()
  if (metadata.uploadDate) cleaned.uploadDate = metadata.uploadDate
  if (metadata.platform) cleaned.platform = metadata.platform
  if (metadata.videoId) cleaned.videoId = metadata.videoId
  if (metadata.tags) cleaned.tags = metadata.tags
  if (metadata.isRecipe !== undefined) cleaned.isRecipe = metadata.isRecipe
  if (metadata.recipeIngredients) cleaned.recipeIngredients = metadata.recipeIngredients

  return cleaned
}

/**
 * Extract ingredients from video description text
 * Enhanced version of the existing function for video descriptions
 */
function extractIngredientsFromDescription(description: string): string[] {
  if (!description) return []

  const ingredients: string[] = []
  const lines = description.split(/[\r\n]+/)
  
  // Look for common ingredient patterns in video descriptions
  const ingredientPatterns = [
    /^[-•*]\s*(.+)$/gm, // Bullet points
    /^\d+\.?\s*(.+)$/gm, // Numbered lists
    /(?:ingredients?|recipe|what you need):?\s*(.+)/gi, // "Ingredients:" sections
    /(\d+\s*(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|grams?|kg|lbs?|oz)\s+[^,\n]+)/gi, // Measurements
  ]

  // First, look for structured ingredient lists
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // Check if line looks like an ingredient (has measurements or common patterns)
    if (trimmedLine.match(/^\d+[\s\w]*[-•*]/) || 
        trimmedLine.match(/\d+\s*(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|grams?|kg|lbs?|oz)/i)) {
      const cleaned = trimmedLine.replace(/^[-•*\d.\s]+/, '').trim()
      if (cleaned.length > 2 && cleaned.length < 100) {
        ingredients.push(cleaned)
      }
    }
  }

  // If no structured list found, try pattern matching
  if (ingredients.length === 0) {
    for (const pattern of ingredientPatterns) {
      const matches = description.matchAll(pattern)
      for (const match of matches) {
        const ingredient = match[1]?.trim()
        if (ingredient && ingredient.length > 2 && ingredient.length < 100) {
          // Avoid duplicate ingredients
          if (!ingredients.some(existing => 
            existing.toLowerCase().includes(ingredient.toLowerCase()) ||
            ingredient.toLowerCase().includes(existing.toLowerCase())
          )) {
            ingredients.push(ingredient)
          }
        }
      }
    }
  }

  // Remove duplicates and return first 15 ingredients max
  return [...new Set(ingredients)].slice(0, 15)
} 