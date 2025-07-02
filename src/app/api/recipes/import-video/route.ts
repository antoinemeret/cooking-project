import { NextRequest } from 'next/server'
import { Ollama } from 'ollama'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { withTempSession } from '@/lib/temp-file-manager'
import { validateVideoUrl, getPlatformDisplayName } from '@/lib/video-url-validator'
import { 
  createProgressResponse, 
  createSuccessResponse, 
  createErrorResponse,
  VideoImportErrorCode,
  type VideoImportResponse,
  type ExtractedRecipeData,
  type ProcessingStats
} from '@/types/video-import'
import { prisma } from '@/lib/prisma'

/**
 * Video Import API Route
 * Handles video recipe imports from social media platforms (Instagram, TikTok, YouTube Shorts)
 */

const getRecipeStructuringPrompt = (transcription: string, metadata?: { title?: string; ingredients?: string[] }) => `
You are an expert recipe parser. Your task is to analyze the following video transcription and extract a structured recipe.

${metadata?.title ? `Video Title: ${metadata.title}` : ''}
${metadata?.ingredients ? `Potential Ingredients (from video description): ${metadata.ingredients.join(', ')}` : ''}

Follow these rules:
1. Extract the recipe title (use video title as fallback if no clear title in transcription)
2. Identify all ingredients mentioned with quantities when available
3. Extract step-by-step cooking instructions from the spoken content
4. The output MUST be a valid JSON object

Expected output format:
{
  "title": "Recipe Name",
  "rawIngredients": [
    "1 cup flour",
    "2 eggs",
    "1/2 tsp salt"
  ],
  "instructions": "Step 1: Mix ingredients. Step 2: Cook for 10 minutes. Step 3: Serve hot."
}

Video Transcription:
---
${transcription}
---
`

/**
 * Enhanced request validation with detailed error reporting
 */
function validateVideoRequest(body: any): { isValid: boolean; error?: string; url?: string; platform?: string; statusCode?: number } {
  // Basic request structure validation
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a valid JSON object', statusCode: 400 }
  }

  const { url } = body

  if (!url) {
    return { isValid: false, error: 'Video URL is required', statusCode: 400 }
  }

  if (typeof url !== 'string') {
    return { isValid: false, error: 'URL must be a string', statusCode: 400 }
  }

  // Comprehensive URL validation
  const validation = validateVideoUrl(url, {
    allowPrivate: false,
    maxUrlLength: 2048
  })

  if (!validation.isValid) {
    // Determine appropriate status code based on error type
    let statusCode = 400
    if (validation.error?.includes('security threats')) {
      statusCode = 403
    } else if (validation.error?.includes('Private or restricted')) {
      statusCode = 403
    } else if (validation.error?.includes('exceeds maximum length')) {
      statusCode = 413
    }
    
    return { 
      isValid: false, 
      error: validation.error,
      statusCode
    }
  }

  return {
    isValid: true,
    url: validation.details?.normalizedUrl || url,
    platform: validation.platform,
    statusCode: 200
  }
}

/**
 * Create timeout wrapper for async operations
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })
  
  return Promise.race([promise, timeoutPromise])
}

/**
 * Enhanced error classification
 */
function classifyError(error: Error, stage: string): { code: VideoImportErrorCode; statusCode: number; userMessage: string } {
  const message = error.message.toLowerCase()
  
  // Network/Download errors
  if (message.includes('video download failed') || message.includes('failed to fetch') || message.includes('network')) {
    return {
      code: VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED,
      statusCode: 502,
      userMessage: 'Failed to download video. The video may be private, removed, or temporarily unavailable.'
    }
  }
  
  // Audio extraction errors
  if (message.includes('audio extraction') || message.includes('format not supported')) {
    return {
      code: VideoImportErrorCode.AUDIO_EXTRACTION_FAILED,
      statusCode: 422,
      userMessage: 'Failed to extract audio from video. The video format may not be supported.'
    }
  }
  
  // Transcription errors
  if (message.includes('transcription failed') || message.includes('whisper')) {
    return {
      code: VideoImportErrorCode.TRANSCRIPTION_FAILED,
      statusCode: 422,
      userMessage: 'Failed to transcribe audio. The audio quality may be too poor or the speech unclear.'
    }
  }
  
  // No speech detected
  if (message.includes('no speech detected') || message.includes('no audio')) {
    return {
      code: VideoImportErrorCode.NO_SPEECH_DETECTED,
      statusCode: 422,
      userMessage: 'No speech was detected in the video. Please ensure the video contains spoken cooking instructions.'
    }
  }
  
  // Recipe structuring errors
  if (message.includes('recipe structuring') || message.includes('not a recipe')) {
    return {
      code: VideoImportErrorCode.RECIPE_STRUCTURING_FAILED,
      statusCode: 422,
      userMessage: 'Failed to extract recipe information. The video content may not contain a clear recipe.'
    }
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      code: VideoImportErrorCode.TIMEOUT,
      statusCode: 408,
      userMessage: 'Processing took too long and was cancelled. Please try again with a shorter video.'
    }
  }
  
  // Private/restricted content
  if (message.includes('private') || message.includes('restricted') || message.includes('forbidden')) {
    return {
      code: VideoImportErrorCode.PRIVATE_CONTENT,
      statusCode: 403,
      userMessage: 'Cannot access private or restricted content. Please ensure the video is publicly accessible.'
    }
  }
  
  // Content unavailable
  if (message.includes('not found') || message.includes('removed') || message.includes('unavailable')) {
    return {
      code: VideoImportErrorCode.CONTENT_UNAVAILABLE,
      statusCode: 404,
      userMessage: 'The video content is no longer available or has been removed.'
    }
  }
  
  // Default to unknown error
  return {
    code: VideoImportErrorCode.UNKNOWN_ERROR,
    statusCode: 500,
    userMessage: 'An unexpected error occurred while processing the video. Please try again.'
  }
}

/**
 * Extract audio from video using yt-dlp
 */
function extractAudio(videoUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'wav',
      '--output', outputPath.replace('.wav', '.%(ext)s'),
      '--no-playlist',
      '--max-duration', '600', // Max 10 minutes
      '--format', 'worst[height<=480]' // Lower quality for faster processing
    ]

    const child = spawn('yt-dlp', args)
    
    let errorOutput = ''
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}: ${errorOutput}`)
        reject(new Error(`Video download failed: ${errorOutput}`))
      } else {
        resolve()
      }
    })

    child.on('error', (err) => {
      console.error('Failed to start yt-dlp:', err)
      reject(new Error('Video processing tool not available'))
    })
  })
}

/**
 * Transcribe audio using Whisper via Ollama
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const ollama = new Ollama()
    
    // Read audio file as base64
    const audioBuffer = await fs.readFile(audioPath)
    const audioBase64 = audioBuffer.toString('base64')
    
    const response = await ollama.generate({
      model: 'dimavz/whisper-tiny:latest',
      prompt: 'Transcribe this audio file',
      images: [audioBase64], // Whisper models accept audio through images parameter
      stream: false
    })

    return response.response || ''
  } catch (error) {
    console.error('Transcription failed:', error)
    throw new Error('Audio transcription failed')
  }
}

/**
 * Structure recipe using Deepseek
 */
async function structureRecipe(transcription: string, metadata?: { title?: string; ingredients?: string[] }): Promise<any> {
  try {
    const ollama = new Ollama()
    
    const response = await ollama.generate({
      model: 'deepseek-r1:latest',
      prompt: getRecipeStructuringPrompt(transcription, metadata),
      stream: false
    })

    // Handle deepseek-r1's thinking format
    let content = response.response
    
    // Extract JSON from between <think> tags if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      content = jsonMatch[1]
    } else {
      // Try to find JSON in the response
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        content = content.substring(jsonStart, jsonEnd + 1)
      }
    }

    return JSON.parse(content)
  } catch (error) {
    console.error('Recipe structuring failed:', error)
    throw new Error('Recipe structuring failed')
  }
}

/**
 * Extract basic metadata from video page (placeholder - will be implemented in Task 3.2)
 */
async function extractVideoMetadata(videoUrl: string): Promise<{ title?: string; ingredients?: string[] }> {
  // TODO: Implement HTML parsing in Task 3.2
  return {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Enhanced request validation
    const validation = validateVideoRequest(body)
    if (!validation.isValid) {
      return new Response(JSON.stringify({ 
        error: validation.error,
        code: VideoImportErrorCode.INVALID_URL,
        suggestions: ['Ensure the URL is from Instagram, TikTok, or YouTube', 'Check that the URL is complete and properly formatted']
      }), {
        status: validation.statusCode || 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { url: validatedUrl, platform } = validation
    
    // Ensure URL is available (it should be since validation passed)
    if (!validatedUrl) {
      return new Response(JSON.stringify({ 
        error: 'Internal validation error',
        code: VideoImportErrorCode.UNKNOWN_ERROR
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get processing timeout from environment or default to 60 seconds
    const processingTimeout = parseInt(process.env.VIDEO_PROCESSING_TIMEOUT || '60000')

    // Create streaming response for progress updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const sendJSON = (response: VideoImportResponse) => {
          controller.enqueue(encoder.encode(JSON.stringify(response) + '\n'))
        }

        // Processing statistics tracking
        const stats: ProcessingStats = {
          startTime: Date.now(),
          stages: {}
        }

        const startStage = (stage: keyof ProcessingStats['stages']) => {
          stats.stages[stage] = {
            startTime: Date.now(),
            success: false
          }
        }

        const endStage = (stage: keyof ProcessingStats['stages'], success: boolean, error?: string) => {
          if (stats.stages[stage]) {
            stats.stages[stage]!.endTime = Date.now()
            stats.stages[stage]!.duration = stats.stages[stage]!.endTime! - stats.stages[stage]!.startTime
            stats.stages[stage]!.success = success
            if (error) stats.stages[stage]!.error = error
          }
        }

        try {
          // Wrap entire processing in timeout
          await withTimeout((async () => {
            // Stage 1: Analyzing
            startStage('analyzing')
            sendJSON(createProgressResponse('analyzing', platform ? getPlatformDisplayName(platform) : undefined))
            
            // Extract video metadata with timeout
            const metadata = await withTimeout(
              extractVideoMetadata(validatedUrl),
              10000,
              'Metadata extraction timed out'
            )
            endStage('analyzing', true)
            
            // Process video with temporary session
            await withTempSession(async (paths) => {
              try {
                // Stage 2: Downloading with timeout
                startStage('downloading')
                sendJSON(createProgressResponse('downloading'))
                
                // Extract audio from video with timeout
                await withTimeout(
                  extractAudio(validatedUrl, paths.audioPath),
                  30000,
                  'Video download and audio extraction timed out'
                )
                endStage('downloading', true)
                
                // Stage 3: Transcribing with timeout
                startStage('transcribing')
                sendJSON(createProgressResponse('transcribing'))
                
                // Transcribe audio to text with timeout
                const transcription = await withTimeout(
                  transcribeAudio(paths.audioPath),
                  20000,
                  'Audio transcription timed out'
                )
                
                if (!transcription.trim()) {
                  endStage('transcribing', false, 'No speech detected')
                  throw new Error('No speech detected in video')
                }

                // Save transcription for debugging
                await fs.writeFile(paths.transcriptPath, transcription)
                endStage('transcribing', true)
                
                // Stage 4: Structuring with timeout
                startStage('structuring')
                sendJSON(createProgressResponse('structuring'))
                
                // Structure recipe using AI with timeout
                const structuredData = await withTimeout(
                  structureRecipe(transcription, metadata),
                  15000,
                  'Recipe structuring timed out'
                )
                endStage('structuring', true)
                
                // Prepare final response data
                const extractedData: ExtractedRecipeData = {
                  title: structuredData.title,
                  rawIngredients: structuredData.rawIngredients || [],
                  instructions: structuredData.instructions || '',
                  sourceUrl: validatedUrl,
                  transcription,
                  metadata: {
                    platform: platform as 'instagram' | 'tiktok' | 'youtube',
                    videoId: undefined, // TODO: Extract from validator
                    extractedAt: new Date().toISOString()
                  }
                }

                // Calculate processing time
                stats.endTime = Date.now()
                stats.duration = stats.endTime - stats.startTime
                
                // Save to database using existing schema
                let savedRecipe
                try {
                  savedRecipe = await withTimeout(
                    prisma.recipe.create({
                      data: {
                        title: structuredData.title || 'Untitled Video Recipe',
                        summary: `Video recipe from ${getPlatformDisplayName(platform!)} - ${validatedUrl}`,
                        instructions: structuredData.instructions || '',
                        rawIngredients: JSON.stringify(structuredData.rawIngredients || []),
                        tags: JSON.stringify([
                          'video-import',
                          platform!,
                          {
                            sourceUrl: validatedUrl,
                            transcription: transcription.substring(0, 1000), // Truncate for storage
                            extractedAt: new Date().toISOString(),
                            platform: platform!,
                            processingTime: stats.duration
                          }
                        ]),
                        startSeason: 1, // Default to all year
                        endSeason: 12,
                        grade: 0, // Default grade
                        time: 0 // Default time - could be extracted from transcription later
                      },
                      include: { ingredients: true }
                    }),
                    5000,
                    'Database save timed out'
                  )
                } catch (dbError) {
                  console.error('Database save error:', dbError)
                  // Continue with response even if save fails, but include warning
                  extractedData.metadata = {
                    ...extractedData.metadata!,
                    recipeId: undefined
                  }
                }

                // Include saved recipe ID in response if successful
                if (savedRecipe) {
                  extractedData.metadata!.recipeId = savedRecipe.id
                }

                const warnings = savedRecipe ? [] : ['Recipe data extracted successfully but failed to save to database']
                sendJSON(createSuccessResponse(extractedData, stats.duration, warnings))
                
              } catch (error: any) {
                console.error('Video processing error:', error)
                
                // Enhanced error classification
                const errorInfo = classifyError(error, 'processing')
                let stage: keyof ProcessingStats['stages'] = 'analyzing'
                
                // Determine stage based on error type and current processing
                if (stats.stages.structuring && !stats.stages.structuring.success) {
                  stage = 'structuring'
                } else if (stats.stages.transcribing && !stats.stages.transcribing.success) {
                  stage = 'transcribing'
                } else if (stats.stages.downloading && !stats.stages.downloading.success) {
                  stage = 'downloading'
                }

                endStage(stage, false, errorInfo.userMessage)
                
                sendJSON(createErrorResponse(
                  errorInfo.userMessage,
                  errorInfo.code,
                  stage
                ))
              }
            })
          })(), processingTimeout, 'Overall processing timed out')
          
        } catch (error: any) {
          console.error('Video import error:', error)
          
          const errorInfo = classifyError(error, 'general')
          let stage: keyof ProcessingStats['stages'] = 'analyzing'
          
          // Determine stage from stats
          if (stats.stages.structuring && !stats.stages.structuring.success) {
            stage = 'structuring'
          } else if (stats.stages.transcribing && !stats.stages.transcribing.success) {
            stage = 'transcribing'
          } else if (stats.stages.downloading && !stats.stages.downloading.success) {
            stage = 'downloading'
          }

          endStage(stage, false, errorInfo.userMessage)
          
          sendJSON(createErrorResponse(
            errorInfo.userMessage,
            errorInfo.code,
            stage
          ))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    })

  } catch (error) {
    console.error('Request parsing error:', error)
    
    // Handle JSON parsing errors and other request-level errors
    const errorInfo = classifyError(error as Error, 'request')
    
    return new Response(JSON.stringify({ 
      error: errorInfo.userMessage,
      code: errorInfo.code,
      suggestions: ['Check that the request body is valid JSON', 'Ensure all required fields are provided']
    }), {
      status: errorInfo.statusCode,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 