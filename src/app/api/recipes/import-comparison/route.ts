import { NextRequest, NextResponse } from 'next/server'
import { parseTraditional } from '@/lib/scrapers/traditional-parser'
import { 
  ImportComparisonRequest, 
  ImportComparisonResponse, 
  ParsingResult, 
  ParsedRecipe 
} from '@/types/comparison'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/prisma'

// Logging utility for the comparison API
class ComparisonLogger {
  private context: string = 'ImportComparison'
  private startTime: number = Date.now()
  private logs: Array<{ level: string; message: string; timestamp: number; data?: any }> = []

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const entry = {
      level,
      message: `[${this.context}] ${message}`,
      timestamp: Date.now() - this.startTime,
      data
    }
    this.logs.push(entry)
    console[level](`[Import Comparison API] ${message}`, data || '')
  }

  getLogs() {
    return this.logs
  }

  getExecutionTime() {
    return Date.now() - this.startTime
  }
}

/**
 * Fetch HTML content from URL with proper headers and error handling
 */
async function fetchHTMLContent(url: string, logger: ComparisonLogger): Promise<string> {
  logger.log('info', 'Fetching HTML content', { url })
  
  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      logger.log('error', 'Failed to fetch HTML', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500)
      })
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    logger.log('info', 'HTML content fetched successfully', {
      contentLength: html.length,
      contentType: response.headers.get('content-type')
    })

    return html
  } catch (error) {
    logger.log('error', 'Error fetching HTML content', { error: String(error) })
    throw error
  }
}

/**
 * Run Ollama parsing approach (existing implementation)
 */
async function runOllamaApproach(html: string, url: string, logger: ComparisonLogger): Promise<ParsingResult> {
  const startTime = Date.now()
  logger.log('info', 'Starting Ollama parsing approach')

  try {
    // Use existing Ollama implementation logic from /api/scrape/route.ts
    const ollamaResult = await callOllamaLLM(html, url, logger)
    const processingTime = Date.now() - startTime

    // Convert Ollama result to our standardized ParsedRecipe format
    const recipe: ParsedRecipe = {
      title: ollamaResult.title || null,
      summary: null, // Ollama approach doesn't extract summary
      instructions: ollamaResult.instructions ? [ollamaResult.instructions] : null,
      ingredients: ollamaResult.rawIngredients || null,
      cookingTime: null, // Ollama approach doesn't extract cooking time
      servings: null, // Ollama approach doesn't extract servings
      difficulty: null,
      cuisine: null,
      tags: []
    }

    const result: ParsingResult = {
      success: !!(recipe.title && (recipe.ingredients || recipe.instructions)),
      recipe: recipe.title ? recipe : null,
      error: recipe.title ? null : 'Ollama failed to extract meaningful recipe data',
      processingTime,
      parsingMethod: 'ollama',
      extractedRawData: ollamaResult
    }

    logger.log('info', 'Ollama parsing completed', {
      success: result.success,
      processingTime,
      hasTitle: !!recipe.title,
      ingredientCount: recipe.ingredients?.length || 0,
      hasInstructions: !!recipe.instructions
    })

    return result
  } catch (error) {
    const processingTime = Date.now() - startTime
    logger.log('error', 'Ollama parsing failed', { error: String(error), processingTime })
    
    return {
      success: false,
      recipe: null,
      error: `Ollama parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime,
      parsingMethod: 'failed',
      extractedRawData: { error: String(error) }
    }
  }
}

/**
 * Call Ollama LLM (extracted from existing scrape route)
 */
async function callOllamaLLM(html: string, url: string, logger: ComparisonLogger) {
  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)
  const mainContent = $('main').text() || $('body').text()
  const safeContent = mainContent.slice(0, 8000)

  logger.log('debug', 'Prepared content for Ollama', {
    originalLength: mainContent.length,
    trimmedLength: safeContent.length
  })

  const prompt = `
  You are an extraction tool.

Your job is to extract the title, ingredients list and instructions exactly as written in the HTML.

Return the text exactly. Do NOT rephrase, translate, correct, or interpret anything.

Return only a JSON object in the following format:
{
  "title" (string), 
  "rawIngredients" (array of strings), 
  "instructions" (string), 
  "url" (string).
  }

If you see "500g de tomates mûres", return it exactly like that. DO NOT normalize it to "tomate".

Here is the HTML: ${safeContent}
  `

  const provider = process.env.LLM_PROVIDER || 'ollama'
  let output = ''

  logger.log('debug', 'Calling LLM', { provider, promptLength: prompt.length })

  if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:latest',
        prompt,
        stream: false
      })
    })
    const data = await res.json()
    output = data.response || ''
  } else {
    const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    })
    const data = await res.json()
    output = data?.[0]?.generated_text || data?.generated_text || ''
  }

  logger.log('debug', 'LLM response received', { outputLength: output.length })

  function extractJson(str: string) {
    // Find all JSON objects in the string
    const matches = str.match(/{[\s\S]*?}/g) || []
    // Take the last match, which should be the recipe JSON
    const lastMatch = matches[matches.length - 1]
    if (!lastMatch) return {}
    try {
      return JSON.parse(lastMatch)
    } catch (e) {
      logger.log('warn', 'JSON parse error in Ollama response', { error: String(e) })
      return {}
    }
  }

  try {
    const result = extractJson(output)
    return { ...result, url }
  } catch {
    return { title: "Erreur de parsing", raw: output, url }
  }
}

/**
 * Run traditional parsing approach
 */
async function runTraditionalApproach(html: string, url: string, logger: ComparisonLogger): Promise<ParsingResult> {
  logger.log('info', 'Starting traditional parsing approach')
  
  try {
    const result = await parseTraditional(html, url)
    
    logger.log('info', 'Traditional parsing completed', {
      success: result.success,
      processingTime: result.processingTime,
      parsingMethod: result.parsingMethod,
      hasTitle: !!result.recipe?.title,
      ingredientCount: result.recipe?.ingredients?.length || 0,
      instructionCount: result.recipe?.instructions?.length || 0
    })

    return result
  } catch (error) {
    logger.log('error', 'Traditional parsing failed', { error: String(error) })
    
    return {
      success: false,
      recipe: null,
      error: `Traditional parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime: 0,
      parsingMethod: 'failed',
      extractedRawData: { error: String(error) }
    }
  }
}

/**
 * Save comparison results to database
 */
async function saveComparisonResult(
  comparisonId: string,
  url: string,
  ollamaResult: ParsingResult,
  traditionalResult: ParsingResult,
  logger: ComparisonLogger
): Promise<void> {
  try {
    logger.log('info', 'Saving comparison results to database', { comparisonId })

    await prisma.comparisonResult.create({
      data: {
        id: comparisonId,
        url,
        timestamp: new Date(),
        ollamaResult: JSON.stringify(ollamaResult),
        traditionalResult: JSON.stringify(traditionalResult),
        status: 'pending', // Default status
        notes: null
      }
    })

    logger.log('info', 'Comparison results saved successfully', { comparisonId })
  } catch (error) {
    logger.log('error', 'Failed to save comparison results to database', {
      comparisonId,
      error: String(error)
    })
    // Don't throw the error - we still want to return the results even if DB save fails
  }
}

/**
 * Update performance metrics for both technologies
 */
async function updatePerformanceMetrics(
  ollamaResult: ParsingResult,
  traditionalResult: ParsingResult,
  logger: ComparisonLogger
): Promise<void> {
  try {
    logger.log('info', 'Updating performance metrics')

    // Update Ollama metrics
    await prisma.performanceMetrics.upsert({
      where: { technologyName: 'ollama' },
      update: {
        totalTests: { increment: 1 },
        successfulParses: ollamaResult.success ? { increment: 1 } : undefined,
        failedParses: !ollamaResult.success ? { increment: 1 } : undefined,
        // Note: We'll calculate more complex metrics in a later task
        lastUpdated: new Date()
      },
      create: {
        technologyName: 'ollama',
        totalTests: 1,
        successfulParses: ollamaResult.success ? 1 : 0,
        failedParses: !ollamaResult.success ? 1 : 0,
        averageProcessingTime: ollamaResult.processingTime,
        successRate: ollamaResult.success ? 100 : 0,
        fastestParse: ollamaResult.processingTime,
        slowestParse: ollamaResult.processingTime,
        medianProcessingTime: ollamaResult.processingTime
      }
    })

    // Update Traditional metrics
    await prisma.performanceMetrics.upsert({
      where: { technologyName: 'traditional' },
      update: {
        totalTests: { increment: 1 },
        successfulParses: traditionalResult.success ? { increment: 1 } : undefined,
        failedParses: !traditionalResult.success ? { increment: 1 } : undefined,
        lastUpdated: new Date()
      },
      create: {
        technologyName: 'traditional',
        totalTests: 1,
        successfulParses: traditionalResult.success ? 1 : 0,
        failedParses: !traditionalResult.success ? 1 : 0,
        averageProcessingTime: traditionalResult.processingTime,
        successRate: traditionalResult.success ? 100 : 0,
        fastestParse: traditionalResult.processingTime,
        slowestParse: traditionalResult.processingTime,
        medianProcessingTime: traditionalResult.processingTime
      }
    })

    logger.log('info', 'Performance metrics updated successfully')
  } catch (error) {
    logger.log('error', 'Failed to update performance metrics', { error: String(error) })
    // Don't throw the error - metrics update failure shouldn't break the API
  }
}

/**
 * Validate request body
 */
function validateRequest(body: any): ImportComparisonRequest | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const { url, timeout } = body

  if (!url || typeof url !== 'string') {
    return null
  }

  // Basic URL validation
  try {
    new URL(url)
  } catch {
    return null
  }

  return {
    url,
    timeout: timeout && typeof timeout === 'number' ? timeout : 30000
  }
}

/**
 * Main POST handler for the comparison API
 */
export async function POST(req: NextRequest): Promise<NextResponse<ImportComparisonResponse>> {
  const logger = new ComparisonLogger()
  const comparisonId = uuidv4()
  
  logger.log('info', 'Import comparison request started', { comparisonId })

  try {
    // Parse and validate request
    const body = await req.json()
    const validatedRequest = validateRequest(body)

    if (!validatedRequest) {
      logger.log('error', 'Invalid request body', { body })
      return NextResponse.json({
        success: false,
        comparisonId,
        results: {
          ollama: {
            success: false,
            recipe: null,
            error: 'Invalid request: missing or invalid URL',
            processingTime: 0,
            parsingMethod: 'failed'
          },
          traditional: {
            success: false,
            recipe: null,
            error: 'Invalid request: missing or invalid URL',
            processingTime: 0,
            parsingMethod: 'failed'
          }
        },
        error: 'Invalid request: missing or invalid URL'
      }, { status: 400 })
    }

    const { url, timeout } = validatedRequest

    logger.log('info', 'Request validated', { url, timeout, comparisonId })

    // Fetch HTML content
    const html = await fetchHTMLContent(url, logger)

    // Run both parsing approaches in parallel
    logger.log('info', 'Starting parallel parsing approaches')
    const [ollamaResult, traditionalResult] = await Promise.all([
      runOllamaApproach(html, url, logger),
      runTraditionalApproach(html, url, logger)
    ])

    const totalExecutionTime = logger.getExecutionTime()

    logger.log('info', 'Comparison completed', {
      comparisonId,
      totalExecutionTime,
      ollamaSuccess: ollamaResult.success,
      traditionalSuccess: traditionalResult.success,
      ollamaTime: ollamaResult.processingTime,
      traditionalTime: traditionalResult.processingTime
    })

    // Save results to database (run in parallel with response)
    await Promise.all([
      saveComparisonResult(comparisonId, url, ollamaResult, traditionalResult, logger),
      updatePerformanceMetrics(ollamaResult, traditionalResult, logger)
    ])

    // Structure response
    const response: ImportComparisonResponse = {
      success: true,
      comparisonId,
      results: {
        ollama: ollamaResult,
        traditional: traditionalResult
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    const totalExecutionTime = logger.getExecutionTime()
    logger.log('error', 'Comparison failed with critical error', {
      error: String(error),
      comparisonId,
      totalExecutionTime
    })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const failedResult: ParsingResult = {
      success: false,
      recipe: null,
      error: `Critical error: ${errorMessage}`,
      processingTime: 0,
      parsingMethod: 'failed',
      extractedRawData: { 
        error: String(error),
        logs: logger.getLogs()
      }
    }

    return NextResponse.json({
      success: false,
      comparisonId,
      results: {
        ollama: failedResult,
        traditional: failedResult
      },
      error: `Comparison failed: ${errorMessage}`
    }, { status: 500 })
  }
} 