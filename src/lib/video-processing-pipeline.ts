/**
 * Video Processing Pipeline
 * Central orchestrator for the complete video-to-recipe processing workflow
 */

import { processVideoUrl, type VideoInfo } from '@/lib/video-processor'
import { extractAudioFromVideo, type AudioExtractionResult } from '@/lib/audio-extractor'
import { transcribeAudio, type TranscriptionResult } from '@/lib/speech-transcriber'
import { structureVideoRecipe, type VideoTranscriptionData, type RecipeStructuringResult } from '@/lib/ai-video-client'
import { extractVideoMetadata, type VideoMetadata } from '@/lib/scrapers/traditional-parser'
import { withTempSession } from '@/lib/temp-file-manager'
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
  warnings: string[]
  
  // Resource usage
  resourceUsage?: {
    tempFilesCreated: number
    maxMemoryUsage: number
    networkRequests: number
  }
}

/**
 * Default processing configuration
 */
const DEFAULT_OPTIONS: Required<VideoProcessingOptions> = {
  audioQuality: 'worst', // Prioritize speed
  maxAudioDuration: 600, // 10 minutes
  transcriptionModel: 'dimavz/whisper-tiny',
  transcriptionLanguage: 'auto',
  transcriptionChunkSize: 30,
  aiModel: 'deepseek-r1:latest',
  aiTemperature: 0.1,
  includePartialResults: true,
  enhanceWithMetadata: true,
  timeout: 300000, // 5 minutes total
  skipMetadataExtraction: false
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

  try {
    onProgress?.({
      stage: 'initializing',
      progress: 0,
      message: 'Starting video processing pipeline...'
    })

    // Use temp session for automatic cleanup
    return await withTempSession(async (tempPaths) => {
      resourceUsage.tempFilesCreated = 4 // Session creates 4 temp paths

      let videoInfo: VideoInfo | undefined
      let videoMetadata: VideoMetadata | undefined
      let audioResult: AudioExtractionResult | undefined
      let transcriptionResult: TranscriptionResult | undefined
      let aiResult: RecipeStructuringResult | undefined

      // Stage 1: URL Validation and Video Info Extraction
      onProgress?.({
        stage: 'url-validation',
        progress: 5,
        message: 'Validating video URL and extracting video information...'
      })

      const urlStageStart = Date.now()
      try {
        const videoProcessResult = await processVideoUrl(url)
        resourceUsage.networkRequests++
        
        if (!videoProcessResult.isValid || !videoProcessResult.videoInfo) {
          stages.urlValidation = {
            success: false,
            duration: Date.now() - urlStageStart,
            error: videoProcessResult.error || 'Invalid video URL'
          }
          
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
        stages.urlValidation = {
          success: false,
          duration: Date.now() - urlStageStart,
          error: `URL validation failed: ${error}`
        }
        
        return createFailedResult(
          `URL validation failed: ${error}`,
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
      onProgress?.({
        stage: 'audio-extraction',
        progress: 25,
        message: 'Extracting audio from video...'
      })

      const audioStageStart = Date.now()
      try {
        audioResult = await extractAudioFromVideo(
          url,
          {
            outputFormat: 'wav',
            quality: config.audioQuality,
            maxDuration: config.maxAudioDuration,
            timeout: 120000 // 2 minutes for audio extraction
          },
          (audioProgress) => {
            onProgress?.({
              stage: 'audio-extraction',
              progress: 25 + (audioProgress.progress || 0) * 0.25, // Scale to 25-50%
              message: 'Extracting audio from video...',
              subProgress: {
                stage: audioProgress.stage,
                progress: audioProgress.progress || 0,
                message: audioProgress.message
              }
            })
          }
        )

        if (!audioResult.success) {
          stages.audioExtraction = {
            success: false,
            duration: Date.now() - audioStageStart,
            error: audioResult.error || 'Audio extraction failed'
          }
          
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
        stages.audioExtraction = {
          success: false,
          duration: Date.now() - audioStageStart,
          error: `Audio extraction failed: ${error}`
        }
        
        return createFailedResult(
          `Audio extraction failed: ${error}`,
          stages,
          warnings,
          startTime,
          resourceUsage
        )
      }

      // Stage 4: Speech Transcription
      onProgress?.({
        stage: 'transcription',
        progress: 50,
        message: 'Transcribing audio to text...'
      })

      const transcriptionStageStart = Date.now()
      try {
        transcriptionResult = await transcribeAudio(
          audioResult.audioPath!,
          {
            model: config.transcriptionModel,
            language: config.transcriptionLanguage,
            chunkSize: config.transcriptionChunkSize,
            timeout: 180000 // 3 minutes for transcription
          },
          (transcriptionProgress) => {
            onProgress?.({
              stage: 'transcription',
              progress: 50 + (transcriptionProgress.progress || 0) * 0.2, // Scale to 50-70%
              message: 'Transcribing audio to text...',
              subProgress: {
                stage: transcriptionProgress.stage,
                progress: transcriptionProgress.progress || 0,
                message: transcriptionProgress.message
              }
            })
          }
        )

        if (!transcriptionResult.success) {
          stages.transcription = {
            success: false,
            duration: Date.now() - transcriptionStageStart,
            error: transcriptionResult.error || 'Transcription failed'
          }
          
          return createFailedResult(
            transcriptionResult.error || 'Transcription failed',
            stages,
            warnings.concat(transcriptionResult.warnings || []),
            startTime,
            resourceUsage
          )
        }

        stages.transcription = {
          success: true,
          duration: Date.now() - transcriptionStageStart
        }

      } catch (error) {
        stages.transcription = {
          success: false,
          duration: Date.now() - transcriptionStageStart,
          error: `Transcription failed: ${error}`
        }
        
        return createFailedResult(
          `Transcription failed: ${error}`,
          stages,
          warnings,
          startTime,
          resourceUsage
        )
      }

      // Stage 5: AI Recipe Structuring
      onProgress?.({
        stage: 'ai-structuring',
        progress: 70,
        message: 'Structuring recipe using AI...'
      })

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

        aiResult = await structureVideoRecipe(
          transcriptionData,
          {
            model: config.aiModel,
            temperature: config.aiTemperature,
            includePartialResults: config.includePartialResults,
            enhanceWithMetadata: config.enhanceWithMetadata,
            timeout: 60000 // 1 minute for AI processing
          },
          (aiProgress) => {
            onProgress?.({
              stage: 'ai-structuring',
              progress: 70 + (aiProgress.progress || 0) * 0.2, // Scale to 70-90%
              message: 'Structuring recipe using AI...',
              subProgress: {
                stage: aiProgress.stage,
                progress: aiProgress.progress || 0,
                message: aiProgress.message
              }
            })
          }
        )

        if (!aiResult.success && !aiResult.partialResults) {
          stages.aiStructuring = {
            success: false,
            duration: Date.now() - aiStageStart,
            error: aiResult.error || 'AI structuring failed'
          }
          
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
        stages.aiStructuring = {
          success: false,
          duration: Date.now() - aiStageStart,
          error: `AI structuring failed: ${error}`
        }
        
        return createFailedResult(
          `AI structuring failed: ${error}`,
          stages,
          warnings,
          startTime,
          resourceUsage
        )
      }

      // Stage 6: Finalization
      onProgress?.({
        stage: 'finalizing',
        progress: 90,
        message: 'Finalizing recipe processing...'
      })

      // Calculate overall quality metrics
      const confidence = aiResult.confidence || 0
      const qualityScore = calculateQualityScore({
        videoInfo,
        transcriptionResult,
        aiResult,
        processingTime: Date.now() - startTime
      })

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Video processing completed successfully!'
      })

      // Return successful result
      return {
        success: true,
        recipe: aiResult.recipe,
        processingTime: Date.now() - startTime,
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
        resourceUsage
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({
      stage: 'failed',
      progress: 0,
      message: `Pipeline failed: ${errorMessage}`
    })

    return createFailedResult(
      `Pipeline failed: ${errorMessage}`,
      stages,
      warnings,
      startTime,
      resourceUsage
    )
  }
}

/**
 * Create a standardized failed result
 */
function createFailedResult(
  error: string,
  stages: VideoProcessingResult['stages'],
  warnings: string[],
  startTime: number,
  resourceUsage: VideoProcessingResult['resourceUsage'],
  intermediateResults?: VideoProcessingResult['intermediateResults']
): VideoProcessingResult {
  return {
    success: false,
    processingTime: Date.now() - startTime,
    stages,
    error,
    warnings,
    resourceUsage,
    intermediateResults
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