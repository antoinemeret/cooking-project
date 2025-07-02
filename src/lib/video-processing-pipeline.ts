/**
 * Video Processing Pipeline
 * Central orchestrator for the complete video-to-recipe processing workflow
 */

import { processVideoUrl, type VideoInfo } from '@/lib/video-processor'
import { extractAudioFromVideo, type AudioExtractionResult } from '@/lib/audio-extractor'
import { transcribeAudio, type TranscriptionResult } from '@/lib/speech-transcriber'
import { structureVideoRecipe, type VideoTranscriptionData, type RecipeStructuringResult } from '@/lib/ai-video-client'
import { extractVideoMetadata, type VideoMetadata } from '@/lib/scrapers/traditional-parser'
import { withTrackedTempSession } from '@/lib/temp-file-manager'
import { performanceMonitor, type PerformanceReport } from '@/lib/performance-monitoring'
import { createUserFriendlyError, type UserFriendlyError, type ErrorContext } from '@/lib/user-friendly-errors'
import { VideoImportErrorCode } from '@/types/video-import'
import { ParsedRecipe } from '@/types/comparison'

export interface VideoProcessingOptions {
  // Audio extraction options
  audioQuality?: 'best' | 'worst' | 'medium'
  maxAudioDuration?: number
  
  // Transcription options
  transcriptionModel?: string
  transcriptionLanguage?: string
  transcriptionChunkSize?: number
  
  // AI structuring options  
  aiModel?: string
  aiTemperature?: number
  includePartialResults?: boolean
  enhanceWithMetadata?: boolean
  
  // Processing options
  timeout?: number
  skipMetadataExtraction?: boolean
  
  // Stage-specific timeout options
  stageTimeouts?: {
    urlValidation?: number
    metadataExtraction?: number
    audioExtraction?: number
    transcription?: number
    aiStructuring?: number
  }
  adaptiveTimeouts?: boolean // Enable adaptive timeout allocation
}

export interface VideoProcessingProgress {
  stage: 'initializing' | 'url-validation' | 'metadata-extraction' | 'audio-extraction' | 
         'transcription' | 'ai-structuring' | 'finalizing' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
  currentStep?: string
  eta?: string
  subProgress?: {
    stage: string
    progress: number
    message?: string
  }
}

export interface VideoProcessingResult {
  success: boolean
  recipe?: ParsedRecipe
  
  // Processing metadata
  processingTime: number
  stages: {
    urlValidation?: { success: boolean; duration: number; error?: string }
    metadataExtraction?: { success: boolean; duration: number; error?: string }
    audioExtraction?: { success: boolean; duration: number; error?: string }
    transcription?: { success: boolean; duration: number; error?: string }
    aiStructuring?: { success: boolean; duration: number; error?: string }
  }
  
  // Intermediate results for debugging/analysis
  intermediateResults?: {
    videoInfo?: VideoInfo
    videoMetadata?: VideoMetadata
    audioResult?: AudioExtractionResult
    transcriptionResult?: TranscriptionResult
    aiResult?: RecipeStructuringResult
  }
  
  // Quality metrics
  confidence?: number
  qualityScore?: number
  
  // Errors and warnings
  error?: string
  userFriendlyError?: UserFriendlyError
  warnings: string[]
  
  // Resource usage
  resourceUsage?: {
    tempFilesCreated: number
    maxMemoryUsage: number
    networkRequests: number
  }
  
  // Performance monitoring
  performanceReport?: PerformanceReport
}

/**
 * Default processing configuration optimized for sub-1-minute processing
 */
const DEFAULT_OPTIONS: Required<VideoProcessingOptions> = {
  audioQuality: 'worst', // Prioritize speed
  maxAudioDuration: 300, // 5 minutes max to speed up processing
  transcriptionModel: 'dimavz/whisper-tiny',
  transcriptionLanguage: 'auto',
  transcriptionChunkSize: 20, // Smaller chunks for faster processing
  aiModel: 'mistral:7b-instruct', // Faster model than deepseek
  aiTemperature: 0.1,
  includePartialResults: true,
  enhanceWithMetadata: true,
  timeout: 55000, // 55 seconds total (5 second buffer)
  skipMetadataExtraction: false,
  
  // Stage-specific timeouts (optimized for speed)
  stageTimeouts: {
    urlValidation: 5000,      // 5 seconds
    metadataExtraction: 5000, // 5 seconds
    audioExtraction: 15000,   // 15 seconds
    transcription: 20000,     // 20 seconds
    aiStructuring: 10000      // 10 seconds
  },
  adaptiveTimeouts: true // Enable adaptive timeout management
}

/**
 * Process video URL through complete pipeline to extract recipe
 */
export async function processVideoThroughPipeline(
  url: string,
  options: VideoProcessingOptions = {},
  onProgress?: (progress: VideoProcessingProgress) => void
): Promise<VideoProcessingResult> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const warnings: string[] = []
  const startTime = Date.now()
  const stages: VideoProcessingResult['stages'] = {}
  let resourceUsage = {
    tempFilesCreated: 0,
    maxMemoryUsage: 0,
    networkRequests: 0
  }

  // Set up timeout monitoring
  const timeoutController = new AbortController()
  const overallTimeout = setTimeout(() => {
    timeoutController.abort()
  }, config.timeout)

  // Adaptive timeout calculator
  const getAdaptiveTimeout = (stageName: keyof Required<VideoProcessingOptions>['stageTimeouts'], defaultTimeout: number): number => {
    if (!config.adaptiveTimeouts) return defaultTimeout
    
    const elapsedTime = Date.now() - startTime
    const remainingTime = config.timeout - elapsedTime
    const stageTimeout = config.stageTimeouts[stageName] || defaultTimeout
    
    // Use the minimum of: configured timeout, remaining time * 0.8, or default
    return Math.min(stageTimeout, remainingTime * 0.8, defaultTimeout)
  }

  try {
    onProgress?.({
      stage: 'initializing',
      progress: 0,
      message: 'Starting video processing pipeline...'
    })

    // Use temp session for automatic cleanup with resource tracking
    return await withTrackedTempSession(async (tempPaths, sessionId, tracker) => {
      resourceUsage.tempFilesCreated = 4 // Session creates 4 temp paths
      
      // Start performance monitoring
      performanceMonitor.startSession(sessionId)
      
              // Check for cancellation at start
        if (tracker.isAborted()) {
          clearTimeout(overallTimeout)
          const report = performanceMonitor.endSession(sessionId, false) || undefined
          return createTimeoutResult('Processing was cancelled by user', stages, warnings, startTime, resourceUsage, undefined, report)
        }

      let videoInfo: VideoInfo | undefined
      let videoMetadata: VideoMetadata | undefined
      let audioResult: AudioExtractionResult | undefined
      let transcriptionResult: TranscriptionResult | undefined
      let aiResult: RecipeStructuringResult | undefined

      // Stage 1: URL Validation and Video Info Extraction
      performanceMonitor.startStage(sessionId, 'url-validation', { url, platform: 'unknown' })
      
      const urlTimeout = getAdaptiveTimeout('urlValidation', 5000)
      const urlElapsed = Date.now() - startTime
      
      onProgress?.({
        stage: 'url-validation',
        progress: 5,
        message: 'Validating video URL and extracting video information...',
        eta: `${Math.round((config.timeout - urlElapsed) / 1000)}s remaining`
      })

      if (timeoutController.signal.aborted) {
        clearTimeout(overallTimeout)
        performanceMonitor.endStage(sessionId, 'url-validation', false, 'Processing timed out')
        const report = performanceMonitor.endSession(sessionId, false) || undefined
        return createTimeoutResult('Processing timed out before URL validation', stages, warnings, startTime, resourceUsage, undefined, report)
      }

      const urlStageStart = Date.now()
      try {
        const videoProcessResult = await Promise.race([
          processVideoUrl(url),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('URL validation timed out')), urlTimeout)
          )
        ])
        
        resourceUsage.networkRequests++
        
        if (!videoProcessResult.isValid || !videoProcessResult.videoInfo) {
          stages.urlValidation = {
            success: false,
            duration: Date.now() - urlStageStart,
            error: videoProcessResult.error || 'Invalid video URL'
          }
          
          clearTimeout(overallTimeout)
          return createFailedResult(
            videoProcessResult.error || 'Invalid video URL',
            stages,
            warnings,
            startTime,
            resourceUsage
          )
        }

        videoInfo = videoProcessResult.videoInfo
        stages.urlValidation = {
          success: true,
          duration: Date.now() - urlStageStart
        }

      } catch (error) {
        const isTimeout = error instanceof Error && error.message.includes('timed out')
        stages.urlValidation = {
          success: false,
          duration: Date.now() - urlStageStart,
          error: isTimeout ? 'URL validation timed out' : `URL validation failed: ${error}`
        }
        
        clearTimeout(overallTimeout)
        return createFailedResult(
          isTimeout ? 'URL validation timed out' : `URL validation failed: ${error}`,
          stages,
          warnings,
          startTime,
          resourceUsage
        )
      }

      // Stage 2: Video Metadata Extraction (Optional)
      if (!config.skipMetadataExtraction) {
        onProgress?.({
          stage: 'metadata-extraction',
          progress: 15,
          message: 'Extracting video metadata from HTML...'
        })

        const metadataStageStart = Date.now()
        try {
          // Fetch video page HTML for metadata extraction
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RecipeExtractor/1.0)'
            }
          })
          resourceUsage.networkRequests++

          if (response.ok) {
            const html = await response.text()
            const metadataResult = await extractVideoMetadata(html, url)
            
            if (metadataResult.success) {
              videoMetadata = metadataResult.metadata
            } else {
              warnings.push(`Metadata extraction warning: ${metadataResult.error}`)
            }
          } else {
            warnings.push(`Failed to fetch video page for metadata: ${response.status}`)
          }

          stages.metadataExtraction = {
            success: true,
            duration: Date.now() - metadataStageStart
          }

        } catch (error) {
          warnings.push(`Metadata extraction failed: ${error}`)
          stages.metadataExtraction = {
            success: false,
            duration: Date.now() - metadataStageStart,
            error: `Metadata extraction failed: ${error}`
          }
        }
      }

      // Stage 3: Audio Extraction
      const audioTimeout = getAdaptiveTimeout('audioExtraction', 15000)
      const audioElapsed = Date.now() - startTime
      
      onProgress?.({
        stage: 'audio-extraction',
        progress: 25,
        message: 'Extracting audio from video...',
        eta: `${Math.round((config.timeout - audioElapsed) / 1000)}s remaining`
      })

      if (timeoutController.signal.aborted) {
        clearTimeout(overallTimeout)
        return createTimeoutResult('Processing timed out before audio extraction', stages, warnings, startTime, resourceUsage)
      }

      const audioStageStart = Date.now()
      try {
        audioResult = await Promise.race([
          extractAudioFromVideo(
            url,
            {
              outputFormat: 'wav',
              quality: config.audioQuality,
              maxDuration: config.maxAudioDuration,
              timeout: audioTimeout,
              maxRetries: 1 // Reduced retries for speed
            },
            (audioProgress) => {
              const remainingTime = config.timeout - (Date.now() - startTime)
              onProgress?.({
                stage: 'audio-extraction',
                progress: 25 + (audioProgress.progress || 0) * 0.25, // Scale to 25-50%
                message: 'Extracting audio from video...',
                eta: `${Math.round(remainingTime / 1000)}s remaining`,
                subProgress: {
                  stage: audioProgress.stage,
                  progress: audioProgress.progress || 0,
                  message: audioProgress.message
                }
              })
            }
          ),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Audio extraction timed out')), audioTimeout)
          )
        ])

        if (!audioResult.success) {
          stages.audioExtraction = {
            success: false,
            duration: Date.now() - audioStageStart,
            error: audioResult.error || 'Audio extraction failed'
          }
          
          clearTimeout(overallTimeout)
          return createFailedResult(
            audioResult.error || 'Audio extraction failed',
            stages,
            warnings.concat(audioResult.warnings || []),
            startTime,
            resourceUsage
          )
        }

        stages.audioExtraction = {
          success: true,
          duration: Date.now() - audioStageStart
        }

      } catch (error) {
        const isTimeout = error instanceof Error && error.message.includes('timed out')
        stages.audioExtraction = {
          success: false,
          duration: Date.now() - audioStageStart,
          error: isTimeout ? 'Audio extraction timed out' : `Audio extraction failed: ${error}`
        }
        
        clearTimeout(overallTimeout)
        return isTimeout 
          ? createTimeoutResult('Audio extraction timed out', stages, warnings, startTime, resourceUsage)
          : createFailedResult(`Audio extraction failed: ${error}`, stages, warnings, startTime, resourceUsage)
      }

      // Stage 4: Speech Transcription
      const transcriptionTimeout = getAdaptiveTimeout('transcription', 20000)
      const transcriptionElapsed = Date.now() - startTime
      
      onProgress?.({
        stage: 'transcription',
        progress: 50,
        message: 'Transcribing audio to text...',
        eta: `${Math.round((config.timeout - transcriptionElapsed) / 1000)}s remaining`
      })

      if (timeoutController.signal.aborted) {
        clearTimeout(overallTimeout)
        return createTimeoutResult('Processing timed out before transcription', stages, warnings, startTime, resourceUsage)
      }

      const transcriptionStageStart = Date.now()
      try {
        transcriptionResult = await Promise.race([
          transcribeAudio(
            audioResult.audioPath!,
            {
              model: config.transcriptionModel,
              language: config.transcriptionLanguage,
              chunkSize: config.transcriptionChunkSize,
              timeout: transcriptionTimeout,
              maxRetries: 1 // Reduced retries for speed
            },
            (transcriptionProgress) => {
              const remainingTime = config.timeout - (Date.now() - startTime)
              onProgress?.({
                stage: 'transcription',
                progress: 50 + (transcriptionProgress.progress || 0) * 0.2, // Scale to 50-70%
                message: 'Transcribing audio to text...',
                eta: `${Math.round(remainingTime / 1000)}s remaining`,
                subProgress: {
                  stage: transcriptionProgress.stage,
                  progress: transcriptionProgress.progress || 0,
                  message: transcriptionProgress.message
                }
              })
            }
          ),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Transcription timed out')), transcriptionTimeout)
          )
        ])

        if (!transcriptionResult.success) {
          stages.transcription = {
            success: false,
            duration: Date.now() - transcriptionStageStart,
            error: transcriptionResult.error || 'Transcription failed'
          }
          
          clearTimeout(overallTimeout)
          // If we have partial transcription, try to continue with AI processing
          if (transcriptionResult.partialTranscription && transcriptionResult.partialTranscription.length > 20) {
            warnings.push('Using partial transcription due to timeout')
            transcriptionResult.text = transcriptionResult.partialTranscription
            transcriptionResult.success = true
          } else {
            return createFailedResult(
              transcriptionResult.error || 'Transcription failed',
              stages,
              warnings.concat(transcriptionResult.warnings || []),
              startTime,
              resourceUsage
            )
          }
        }

        stages.transcription = {
          success: true,
          duration: Date.now() - transcriptionStageStart
        }

      } catch (error) {
        const isTimeout = error instanceof Error && error.message.includes('timed out')
        stages.transcription = {
          success: false,
          duration: Date.now() - transcriptionStageStart,
          error: isTimeout ? 'Transcription timed out' : `Transcription failed: ${error}`
        }
        
        clearTimeout(overallTimeout)
        return isTimeout 
          ? createTimeoutResult('Transcription timed out', stages, warnings, startTime, resourceUsage)
          : createFailedResult(`Transcription failed: ${error}`, stages, warnings, startTime, resourceUsage)
      }

      // Stage 5: AI Recipe Structuring
      const aiTimeout = getAdaptiveTimeout('aiStructuring', 10000)
      const aiElapsed = Date.now() - startTime
      
      onProgress?.({
        stage: 'ai-structuring',
        progress: 70,
        message: 'Structuring recipe using AI...',
        eta: `${Math.round((config.timeout - aiElapsed) / 1000)}s remaining`
      })

      if (timeoutController.signal.aborted) {
        clearTimeout(overallTimeout)
        return createTimeoutResult('Processing timed out before AI structuring', stages, warnings, startTime, resourceUsage)
      }

      const aiStageStart = Date.now()
      try {
        const transcriptionData: VideoTranscriptionData = {
          text: transcriptionResult.text!,
          duration: transcriptionResult.duration,
          confidence: transcriptionResult.confidence,
          videoMetadata: videoMetadata ? {
            title: videoMetadata.title,
            description: videoMetadata.description,
            uploader: videoMetadata.uploader,
            platform: videoMetadata.platform,
            originalUrl: url,
            thumbnail: videoMetadata.thumbnail
          } : undefined,
          audioMetadata: audioResult.metadata ? {
            duration: audioResult.duration,
            format: 'wav'
          } : undefined
        }

        aiResult = await Promise.race([
          structureVideoRecipe(
            transcriptionData,
            {
              model: config.aiModel,
              temperature: config.aiTemperature,
              includePartialResults: config.includePartialResults,
              enhanceWithMetadata: config.enhanceWithMetadata,
              timeout: aiTimeout
            },
            (aiProgress) => {
              const remainingTime = config.timeout - (Date.now() - startTime)
              onProgress?.({
                stage: 'ai-structuring',
                progress: 70 + (aiProgress.progress || 0) * 0.2, // Scale to 70-90%
                message: 'Structuring recipe using AI...',
                eta: `${Math.round(remainingTime / 1000)}s remaining`,
                subProgress: {
                  stage: aiProgress.stage,
                  progress: aiProgress.progress || 0,
                  message: aiProgress.message
                }
              })
            }
          ),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('AI structuring timed out')), aiTimeout)
          )
        ])

        if (!aiResult.success && !aiResult.partialResults) {
          stages.aiStructuring = {
            success: false,
            duration: Date.now() - aiStageStart,
            error: aiResult.error || 'AI structuring failed'
          }
          
          clearTimeout(overallTimeout)
          return createFailedResult(
            aiResult.error || 'AI structuring failed',
            stages,
            warnings.concat(aiResult.warnings || []),
            startTime,
            resourceUsage,
            { videoInfo, videoMetadata, audioResult, transcriptionResult, aiResult }
          )
        }

        stages.aiStructuring = {
          success: aiResult.success,
          duration: Date.now() - aiStageStart
        }

        if (aiResult.warnings) {
          warnings.push(...aiResult.warnings)
        }

      } catch (error) {
        const isTimeout = error instanceof Error && error.message.includes('timed out')
        stages.aiStructuring = {
          success: false,
          duration: Date.now() - aiStageStart,
          error: isTimeout ? 'AI structuring timed out' : `AI structuring failed: ${error}`
        }
        
        clearTimeout(overallTimeout)
        return isTimeout 
          ? createTimeoutResult('AI structuring timed out', stages, warnings, startTime, resourceUsage)
          : createFailedResult(`AI structuring failed: ${error}`, stages, warnings, startTime, resourceUsage)
      }

      // Stage 6: Finalization
      onProgress?.({
        stage: 'finalizing',
        progress: 90,
        message: 'Finalizing recipe processing...'
      })

      // Clear timeout since we're finishing successfully
      clearTimeout(overallTimeout)

      // Calculate overall quality metrics
      const confidence = aiResult.confidence || 0
      const qualityScore = calculateQualityScore({
        videoInfo,
        transcriptionResult,
        aiResult,
        processingTime: Date.now() - startTime
      })

      const finalProcessingTime = Date.now() - startTime
      
      // End performance monitoring and generate report
      const performanceReport = performanceMonitor.endSession(sessionId, true) || undefined
      
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: `Video processing completed successfully in ${Math.round(finalProcessingTime / 1000)}s!`
      })

      // Return successful result
      return {
        success: true,
        recipe: aiResult.recipe,
        processingTime: finalProcessingTime,
        stages,
        intermediateResults: {
          videoInfo,
          videoMetadata,
          audioResult,
          transcriptionResult,
          aiResult
        },
        confidence,
        qualityScore,
        warnings,
        resourceUsage,
        performanceReport
      }
    }, timeoutController)

  } catch (error) {
    clearTimeout(overallTimeout)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('aborted')
    
    onProgress?.({
      stage: 'failed',
      progress: 0,
      message: isTimeout ? 'Processing timed out' : `Pipeline failed: ${errorMessage}`
    })

    return isTimeout 
      ? createTimeoutResult('Pipeline timed out', stages, warnings, startTime, resourceUsage)
      : createFailedResult(`Pipeline failed: ${errorMessage}`, stages, warnings, startTime, resourceUsage)
  }
}

/**
 * Create a standardized failed result with user-friendly error
 */
function createFailedResult(
  error: string,
  stages: VideoProcessingResult['stages'],
  warnings: string[],
  startTime: number,
  resourceUsage: VideoProcessingResult['resourceUsage'],
  intermediateResults?: VideoProcessingResult['intermediateResults'],
  errorCode?: VideoImportErrorCode,
  context?: ErrorContext
): VideoProcessingResult {
  let userFriendlyError: UserFriendlyError | undefined
  
  if (errorCode) {
    userFriendlyError = createUserFriendlyError(errorCode, error, context)
  }
  
  return {
    success: false,
    processingTime: Date.now() - startTime,
    stages,
    error,
    userFriendlyError,
    warnings,
    resourceUsage,
    intermediateResults
  }
}

/**
 * Create a standardized timeout result with user-friendly error
 */
function createTimeoutResult(
  error: string,
  stages: VideoProcessingResult['stages'],
  warnings: string[],
  startTime: number,
  resourceUsage: VideoProcessingResult['resourceUsage'],
  intermediateResults?: VideoProcessingResult['intermediateResults'],
  performanceReport?: PerformanceReport,
  context?: ErrorContext
): VideoProcessingResult {
  const errorMessage = `${error} (Processing exceeded ${Math.round((Date.now() - startTime) / 1000)}s timeout)`
  
  // Create user-friendly timeout error
  const userFriendlyError = createUserFriendlyError(
    VideoImportErrorCode.TIMEOUT,
    errorMessage,
    {
      ...context,
      processingTime: Date.now() - startTime
    }
  )
  
  return {
    success: false,
    processingTime: Date.now() - startTime,
    stages,
    error: errorMessage,
    userFriendlyError,
    warnings: [...warnings, 'Processing was terminated due to timeout'],
    resourceUsage,
    intermediateResults,
    performanceReport
  }
}

/**
 * Calculate overall quality score based on processing results
 */
function calculateQualityScore(data: {
  videoInfo?: VideoInfo
  transcriptionResult?: TranscriptionResult
  aiResult?: RecipeStructuringResult
  processingTime: number
}): number {
  let score = 0.5 // Base score

  // Video quality factors
  if (data.videoInfo?.metadata?.title) score += 0.1
  if (data.videoInfo?.metadata?.description) score += 0.05

  // Transcription quality factors
  if (data.transcriptionResult?.confidence) {
    score += data.transcriptionResult.confidence * 0.2
  }
  if (data.transcriptionResult?.text && data.transcriptionResult.text.length > 100) {
    score += 0.1
  }

  // AI structuring quality factors
  if (data.aiResult?.confidence) {
    score += data.aiResult.confidence * 0.25
  }
  if (data.aiResult?.recipe?.ingredients && data.aiResult.recipe.ingredients.length > 2) {
    score += 0.1
  }
  if (data.aiResult?.recipe?.instructions && data.aiResult.recipe.instructions.length > 1) {
    score += 0.1
  }

  // Processing efficiency factors (faster is better, up to a point)
  if (data.processingTime < 60000) { // Under 1 minute
    score += 0.05
  } else if (data.processingTime > 300000) { // Over 5 minutes
    score -= 0.05
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Get pipeline status for monitoring
 */
export function getPipelineStatus(): {
  isHealthy: boolean
  components: {
    ollama: boolean
    whisperModel: boolean
    deepseekModel: boolean
    ytDlp: boolean
    ffmpeg: boolean
  }
  lastCheck: string
} {
  // This would be implemented to check system health
  return {
    isHealthy: true,
    components: {
      ollama: true,
      whisperModel: true,
      deepseekModel: true,
      ytDlp: true,
      ffmpeg: true
    },
    lastCheck: new Date().toISOString()
  }
} 