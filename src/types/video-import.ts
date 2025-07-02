/**
 * Video Import API Types
 * Comprehensive type definitions for video recipe import responses
 */

export type VideoProcessingStage = 
  | 'analyzing'
  | 'downloading'
  | 'transcribing' 
  | 'structuring'
  | 'done'
  | 'error'

export type VideoPlatform = 'instagram' | 'tiktok' | 'youtube'

/**
 * Base response interface for all video processing responses
 */
export interface VideoImportBaseResponse {
  status: VideoProcessingStage
  timestamp?: number
}

/**
 * Progress update response for ongoing processing
 */
export interface VideoImportProgressResponse extends VideoImportBaseResponse {
  status: Exclude<VideoProcessingStage, 'done' | 'error'>
  platform?: string
  message?: string
  progress?: {
    current: number
    total: number
    percentage?: number
  }
}

/**
 * Structured recipe data extracted from video
 */
export interface ExtractedRecipeData {
  title: string
  rawIngredients: string[]
  instructions: string
  sourceUrl: string
  transcription: string
  metadata?: {
    platform: VideoPlatform
    videoId?: string
    duration?: number
    extractedAt: string
    recipeId?: number
  }
}

/**
 * Successful completion response
 */
export interface VideoImportSuccessResponse extends VideoImportBaseResponse {
  status: 'done'
  data: ExtractedRecipeData
  processingTime?: number
  warnings?: string[]
}

/**
 * Error response for failed processing
 */
export interface VideoImportErrorResponse extends VideoImportBaseResponse {
  status: 'error'
  error: string
  code?: VideoImportErrorCode
  details?: {
    stage: VideoProcessingStage
    originalError?: string
    suggestions?: string[]
  }
  partialData?: Partial<ExtractedRecipeData>
}

/**
 * Union type for all possible video import responses
 */
export type VideoImportResponse = 
  | VideoImportProgressResponse
  | VideoImportSuccessResponse
  | VideoImportErrorResponse

/**
 * Error codes for different failure scenarios
 */
export enum VideoImportErrorCode {
  INVALID_URL = 'INVALID_URL',
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  VIDEO_DOWNLOAD_FAILED = 'VIDEO_DOWNLOAD_FAILED',
  AUDIO_EXTRACTION_FAILED = 'AUDIO_EXTRACTION_FAILED',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  NO_SPEECH_DETECTED = 'NO_SPEECH_DETECTED',
  RECIPE_STRUCTURING_FAILED = 'RECIPE_STRUCTURING_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  PRIVATE_CONTENT = 'PRIVATE_CONTENT',
  CONTENT_UNAVAILABLE = 'CONTENT_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Request payload for video import API
 */
export interface VideoImportRequest {
  url: string
  options?: {
    includeTranscription?: boolean
    language?: string
    quality?: 'low' | 'medium' | 'high'
    timeout?: number
  }
}

/**
 * Video validation result (from validator)
 */
export interface VideoValidationResult {
  isValid: boolean
  platform?: VideoPlatform
  error?: string
  normalizedUrl?: string
  videoId?: string
}

/**
 * Processing statistics for monitoring
 */
export interface ProcessingStats {
  startTime: number
  endTime?: number
  duration?: number
  stages: {
    [K in VideoProcessingStage]?: {
      startTime: number
      endTime?: number
      duration?: number
      success: boolean
      error?: string
    }
  }
  resourceUsage?: {
    tempFileSize?: number
    audioFileSize?: number
    transcriptionLength?: number
  }
}

/**
 * Extended response with processing statistics (for debugging/monitoring)
 */
export interface VideoImportDetailedResponse extends VideoImportSuccessResponse {
  stats: ProcessingStats
  debug?: {
    originalTranscription: string
    aiPrompt: string
    aiResponse: string
    processingWarnings: string[]
  }
}

/**
 * Streaming response helpers
 */
export interface VideoImportStreamChunk {
  data: VideoImportResponse
  event?: string
  id?: string
}

/**
 * Type guards for response discrimination
 */
export function isProgressResponse(response: VideoImportResponse): response is VideoImportProgressResponse {
  return !['done', 'error'].includes(response.status)
}

export function isSuccessResponse(response: VideoImportResponse): response is VideoImportSuccessResponse {
  return response.status === 'done'
}

export function isErrorResponse(response: VideoImportResponse): response is VideoImportErrorResponse {
  return response.status === 'error'
}

/**
 * Error message mapping for user-friendly display
 */
export const ERROR_MESSAGES: Record<VideoImportErrorCode, string> = {
  [VideoImportErrorCode.INVALID_URL]: 'The provided URL is not valid. Please check the URL format.',
  [VideoImportErrorCode.UNSUPPORTED_PLATFORM]: 'This platform is not supported. Only Instagram, TikTok, and YouTube Shorts are supported.',
  [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: 'Failed to download the video. The video may be private or no longer available.',
  [VideoImportErrorCode.AUDIO_EXTRACTION_FAILED]: 'Failed to extract audio from the video. The video format may not be supported.',
  [VideoImportErrorCode.TRANSCRIPTION_FAILED]: 'Failed to transcribe the audio. The audio quality may be too poor.',
  [VideoImportErrorCode.NO_SPEECH_DETECTED]: 'No speech was detected in the video. Please ensure the video contains spoken instructions.',
  [VideoImportErrorCode.RECIPE_STRUCTURING_FAILED]: 'Failed to extract recipe information from the transcription. The content may not be a recipe.',
  [VideoImportErrorCode.TIMEOUT]: 'Processing took too long and was cancelled. Please try again with a shorter video.',
  [VideoImportErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment before trying again.',
  [VideoImportErrorCode.PRIVATE_CONTENT]: 'Cannot access private or restricted content. Please ensure the video is publicly accessible.',
  [VideoImportErrorCode.CONTENT_UNAVAILABLE]: 'The video content is no longer available or has been removed.',
  [VideoImportErrorCode.QUOTA_EXCEEDED]: 'Processing quota exceeded. Please try again later.',
  [VideoImportErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
}

/**
 * Stage descriptions for progress updates
 */
export const STAGE_DESCRIPTIONS: Record<Exclude<VideoProcessingStage, 'done' | 'error'>, string> = {
  analyzing: 'Analyzing video URL and validating platform compatibility...',
  downloading: 'Downloading video and extracting audio content...',
  transcribing: 'Converting speech to text using AI transcription...',
  structuring: 'Extracting recipe information and formatting results...'
}

/**
 * Helper functions for creating responses
 */
export function createProgressResponse(
  stage: Exclude<VideoProcessingStage, 'done' | 'error'>,
  platform?: string,
  progress?: VideoImportProgressResponse['progress']
): VideoImportProgressResponse {
  return {
    status: stage,
    timestamp: Date.now(),
    platform,
    message: STAGE_DESCRIPTIONS[stage],
    progress
  }
}

export function createSuccessResponse(
  data: ExtractedRecipeData,
  processingTime?: number,
  warnings?: string[]
): VideoImportSuccessResponse {
  return {
    status: 'done',
    timestamp: Date.now(),
    data,
    processingTime,
    warnings
  }
}

export function createErrorResponse(
  error: string,
  code?: VideoImportErrorCode,
  stage?: VideoProcessingStage,
  partialData?: Partial<ExtractedRecipeData>
): VideoImportErrorResponse {
  return {
    status: 'error',
    timestamp: Date.now(),
    error,
    code,
    details: stage ? { stage, suggestions: getSuggestionsForError(code) } : undefined,
    partialData
  }
}

/**
 * Get helpful suggestions based on error code
 */
function getSuggestionsForError(code?: VideoImportErrorCode): string[] {
  switch (code) {
    case VideoImportErrorCode.INVALID_URL:
      return [
        'Ensure the URL is from Instagram, TikTok, or YouTube',
        'Check that the URL is complete and properly formatted',
        'Try copying the URL directly from the platform'
      ]
    case VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED:
      return [
        'Verify the video is publicly accessible',
        'Check if the video still exists on the platform',
        'Try again in a few minutes'
      ]
    case VideoImportErrorCode.NO_SPEECH_DETECTED:
      return [
        'Ensure the video contains spoken cooking instructions',
        'Check that the video has audio',
        'Try a video with clearer speech'
      ]
    case VideoImportErrorCode.RECIPE_STRUCTURING_FAILED:
      return [
        'Make sure the video is about cooking or recipes',
        'Try a video with clearer recipe instructions',
        'Check that ingredients and steps are mentioned in the video'
      ]
    default:
      return ['Please try again or contact support if the problem persists']
  }
} 