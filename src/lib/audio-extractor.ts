/**
 * Audio Extractor
 * Handles audio extraction from video URLs using yt-dlp with platform-specific optimizations
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { processVideoUrl, type VideoInfo, type SupportedPlatform, getPlatformProcessingOptions } from '@/lib/video-processor'
import { withTempFile } from '@/lib/temp-file-manager'
import { VideoImportErrorCode, ERROR_MESSAGES } from '@/types/video-import'

export interface AudioExtractionOptions {
  outputFormat?: 'wav' | 'mp3' | 'aac'
  sampleRate?: number
  maxDuration?: number
  quality?: 'best' | 'worst' | 'medium'
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  enableBackup?: boolean // Try alternative extraction methods
}

export interface AudioExtractionResult {
  success: boolean
  audioPath?: string
  duration?: number
  metadata?: {
    title?: string
    uploader?: string
    platform?: string
    originalUrl?: string
    videoId?: string
  }
  error?: string
  errorCode?: VideoImportErrorCode
  warnings?: string[]
  retryable?: boolean
  suggestions?: string[]
  retryCount?: number
  processingTime?: number
}

export interface AudioExtractionProgress {
  stage: 'initializing' | 'downloading' | 'extracting' | 'finalizing' | 'completed' | 'failed'
  progress?: number
  message?: string
  eta?: string
}

/**
 * Extract audio from video URL with comprehensive error handling and retry logic
 */
export async function extractAudioFromVideo(
  url: string,
  options: AudioExtractionOptions = {},
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<AudioExtractionResult> {
  const warnings: string[] = []
  const startTime = Date.now()
  
  try {
    onProgress?.({ stage: 'initializing', message: 'Validating video URL...' })

    // Step 1: Validate and process video URL
    const videoProcessResult = await processVideoUrl(url)
    if (!videoProcessResult.isValid || !videoProcessResult.videoInfo) {
      const errorCode = categorizeValidationError(videoProcessResult.error || '')
      return createErrorResult(
        videoProcessResult.error || 'Invalid video URL',
        errorCode,
        warnings,
        startTime
      )
    }

    const videoInfo = videoProcessResult.videoInfo
    const platformOptions = getPlatformProcessingOptions(videoInfo.platform)

    // Step 2: Configure extraction options based on platform
    const extractionOptions = {
      outputFormat: options.outputFormat || platformOptions.audioFormat as 'wav',
      sampleRate: options.sampleRate || 16000, // Optimal for speech recognition
      maxDuration: options.maxDuration || platformOptions.maxDuration,
      quality: options.quality || 'worst', // Prioritize speed over quality for speech
      timeout: options.timeout || 120000, // 2 minutes timeout
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds between retries
      enableBackup: options.enableBackup !== false // Default to true
    }

    onProgress?.({ 
      stage: 'downloading', 
      message: `Extracting audio from ${videoInfo.platform} video...`,
      progress: 10
    })

    // Step 3: Extract audio with retry logic
    const audioResult = await withTempFile(
      extractionOptions.outputFormat,
      async (tempAudioPath: string) => {
        return await performAudioExtractionWithRetry(
          url,
          tempAudioPath,
          videoInfo,
          extractionOptions,
          onProgress
        )
      }
    )

    if (!audioResult.success) {
      return {
        ...audioResult,
        warnings: warnings.concat(audioResult.warnings || []),
        processingTime: Date.now() - startTime
      }
    }

    onProgress?.({ 
      stage: 'completed', 
      message: 'Audio extraction completed successfully',
      progress: 100
    })

    return {
      success: true,
      audioPath: audioResult.audioPath,
      duration: audioResult.duration,
      metadata: {
        title: videoInfo.metadata?.title,
        uploader: videoInfo.metadata?.uploader,
        platform: videoInfo.platform,
        originalUrl: videoInfo.originalUrl,
        videoId: videoInfo.videoId
      },
      warnings,
      processingTime: Date.now() - startTime
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = categorizeExtractionError(errorMessage)
    
    onProgress?.({ 
      stage: 'failed', 
      message: `Audio extraction failed: ${errorMessage}` 
    })

    return createErrorResult(
      `Audio extraction failed: ${errorMessage}`,
      errorCode,
      warnings,
      startTime
    )
  }
}

/**
 * Perform audio extraction with comprehensive retry logic
 */
async function performAudioExtractionWithRetry(
  url: string,
  outputPath: string,
  videoInfo: VideoInfo,
  options: Required<AudioExtractionOptions>,
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<AudioExtractionResult> {
  let lastError: string = ''
  let lastErrorCode: VideoImportErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      // Attempt extraction
      const result = await performAudioExtraction(
        url,
        outputPath,
        videoInfo,
        options,
        onProgress,
        attempt
      )

      if (result.success) {
        return { ...result, retryCount: attempt - 1 }
      }

      // Categorize the error
      lastErrorCode = categorizeExtractionError(result.error || '')
      lastError = result.error || 'Unknown extraction error'
      
      // Check if error is retryable
      const isRetryable = isErrorRetryable(lastErrorCode, result.error || '')
      
      if (!isRetryable || attempt === options.maxRetries) {
        return {
          ...result,
          errorCode: lastErrorCode,
          retryable: isRetryable,
          suggestions: getSuggestionsForErrorCode(lastErrorCode),
          retryCount: attempt
        }
      }

      // Wait before retry (with exponential backoff)
      const delay = options.retryDelay * Math.pow(1.5, attempt - 1)
      onProgress?.({
        stage: 'downloading',
        message: `Retry ${attempt}/${options.maxRetries} in ${Math.round(delay/1000)}s...`,
        progress: 10
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      lastErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
      
      if (attempt === options.maxRetries) {
        return createErrorResult(lastError, lastErrorCode, [], 0, true, attempt)
      }
    }
  }

  // Fallback: try backup extraction method if enabled
  if (options.enableBackup) {
    onProgress?.({
      stage: 'downloading',
      message: 'Trying backup extraction method...',
      progress: 15
    })
    
    try {
      const backupResult = await performBackupAudioExtraction(
        url,
        outputPath,
        videoInfo,
        options,
        onProgress
      )
      
      if (backupResult.success) {
        return {
          ...backupResult,
          retryCount: options.maxRetries,
          warnings: [...(backupResult.warnings || []), 'Used backup extraction method']
        }
      }
    } catch (backupError) {
      // Backup failed, return original error
    }
  }

  return createErrorResult(
    lastError,
    lastErrorCode,
    [],
    0,
    false,
    options.maxRetries
  )
}

/**
 * Perform the actual audio extraction using yt-dlp
 */
async function performAudioExtraction(
  url: string,
  outputPath: string,
  videoInfo: VideoInfo,
  options: Required<AudioExtractionOptions>,
  onProgress?: (progress: AudioExtractionProgress) => void,
  attempt?: number
): Promise<AudioExtractionResult> {
  return new Promise((resolve) => {
    const args = buildYtDlpArgs(url, outputPath, videoInfo.platform, options)

    console.log('Running yt-dlp with args:', args)
    const child = spawn('yt-dlp', args)

    let duration: number | undefined
    let currentProgress = 10
    const warnings: string[] = []

    child.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('yt-dlp stdout:', output)

      // Parse duration from output
      const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+)/)
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 3600 + 
                  parseInt(durationMatch[2]) * 60 + 
                  parseInt(durationMatch[3])
      }

      // Parse progress from output
      const progressMatch = output.match(/(\d+\.?\d*)%/)
      if (progressMatch) {
        const progress = Math.min(90, Math.max(currentProgress, parseFloat(progressMatch[1])))
        currentProgress = progress
        onProgress?.({
          stage: 'extracting',
          message: 'Extracting audio...',
          progress
        })
      }

      // Parse ETA
      const etaMatch = output.match(/ETA (\d+:\d+)/)
      if (etaMatch) {
        onProgress?.({
          stage: 'extracting',
          message: 'Extracting audio...',
          progress: currentProgress,
          eta: etaMatch[1]
        })
      }
    })

    child.stderr.on('data', (data) => {
      const error = data.toString()
      console.warn('yt-dlp stderr:', error)

      // Collect warnings but don't fail for common warnings
      if (error.includes('WARNING')) {
        warnings.push(error.trim())
      }

      // Update progress based on stderr messages
      if (error.includes('Downloading')) {
        onProgress?.({
          stage: 'downloading',
          message: 'Downloading video...',
          progress: Math.max(currentProgress, 30)
        })
      } else if (error.includes('Extracting')) {
        onProgress?.({
          stage: 'extracting',
          message: 'Extracting audio...',
          progress: Math.max(currentProgress, 60)
        })
      }
    })

    child.on('close', async (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `yt-dlp process failed with code ${code}`,
          warnings
        })
        return
      }

      try {
        // Verify the output file exists and has content
        const stats = await fs.stat(outputPath)
        if (stats.size === 0) {
          resolve({
            success: false,
            error: 'Audio extraction produced empty file',
            warnings
          })
          return
        }

        onProgress?.({
          stage: 'finalizing',
          message: 'Finalizing audio file...',
          progress: 95
        })

        resolve({
          success: true,
          audioPath: outputPath,
          duration,
          warnings
        })

      } catch (statError) {
        resolve({
          success: false,
          error: `Failed to verify extracted audio file: ${statError}`,
          warnings
        })
      }
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `yt-dlp process error: ${error.message}`,
        warnings
      })
    })

    // Set up timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM')
        resolve({
          success: false,
          error: `Audio extraction timed out after ${options.timeout}ms`,
          warnings
        })
      }
    }, options.timeout)
  })
}

/**
 * Build yt-dlp command line arguments based on platform and options
 */
function buildYtDlpArgs(
  url: string,
  outputPath: string,
  platform: SupportedPlatform,
  options: Required<AudioExtractionOptions>
): string[] {
  const args = [
    url,
    '--extract-audio',
    '--audio-format', options.outputFormat,
    '--audio-quality', '5', // Compromise between quality and speed
    '--output', outputPath.replace(/\.[^.]+$/, '.%(ext)s'), // Let yt-dlp handle extension
    '--no-playlist',
    '--no-warnings'
  ]

  // Platform-specific optimizations (simplified for audio extraction)
  switch (platform) {
    case 'instagram':
      args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15')
      break

    case 'tiktok':
      args.push('--user-agent', 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36')
      break

    case 'youtube':
      args.push('--user-agent', 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36')
      break
  }

  // Sample rate configuration
  if (options.sampleRate !== 44100) {
    args.push('--postprocessor-args', `ffmpeg:-ar ${options.sampleRate}`)
  }

  return args
}

/**
 * Get audio file information without extraction
 */
export async function getAudioInfo(filePath: string): Promise<{
  duration?: number
  sampleRate?: number
  channels?: number
  format?: string
  size?: number
}> {
  try {
    const stats = await fs.stat(filePath)
    
    return new Promise((resolve, reject) => {
      const args = ['-i', filePath, '-f', 'null', '-']
      const child = spawn('ffprobe', args)

      let duration: number | undefined
      let sampleRate: number | undefined
      let channels: number | undefined
      let format: string | undefined

      child.stderr.on('data', (data) => {
        const output = data.toString()

        // Parse duration
        const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          duration = hours * 3600 + minutes * 60 + seconds
        }

        // Parse audio stream info
        const audioMatch = output.match(/Stream #\d+:\d+.*Audio: (\w+).*?(\d+) Hz.*?(\d+) channels?/)
        if (audioMatch) {
          format = audioMatch[1]
          sampleRate = parseInt(audioMatch[2])
          channels = parseInt(audioMatch[3])
        }
      })

      child.on('close', () => {
        resolve({
          duration,
          sampleRate,
          channels,
          format,
          size: stats.size
        })
      })

      child.on('error', reject)
    })

  } catch (error) {
    throw new Error(`Failed to get audio info: ${error}`)
  }
}

/**
 * Validate audio file for speech recognition readiness
 */
export async function validateAudioForSpeech(filePath: string): Promise<{
  isValid: boolean
  issues?: string[]
  recommendations?: string[]
}> {
  try {
    const info = await getAudioInfo(filePath)
    const issues: string[] = []
    const recommendations: string[] = []

    // Check file size
    if (!info.size || info.size < 1000) {
      issues.push('Audio file is too small or empty')
    } else if (info.size > 50 * 1024 * 1024) { // 50MB
      recommendations.push('Audio file is quite large, consider shorter clips for faster processing')
    }

    // Check duration
    if (!info.duration) {
      issues.push('Could not determine audio duration')
    } else if (info.duration < 1) {
      issues.push('Audio is too short (less than 1 second)')
    } else if (info.duration > 600) { // 10 minutes
      issues.push('Audio is too long (more than 10 minutes)')
    }

    // Check sample rate
    if (info.sampleRate && info.sampleRate < 8000) {
      issues.push('Sample rate is too low for good speech recognition')
    } else if (info.sampleRate && info.sampleRate < 16000) {
      recommendations.push('Higher sample rate (16kHz+) would improve speech recognition')
    }

    // Check channels
    if (info.channels && info.channels > 2) {
      recommendations.push('Mono or stereo audio is sufficient for speech recognition')
    }

    return {
      isValid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    }

  } catch (error) {
    return {
      isValid: false,
      issues: [`Failed to validate audio: ${error}`]
    }
  }
}

/**
 * Categorize validation errors into specific error codes
 */
function categorizeValidationError(error: string): VideoImportErrorCode {
  const lowerError = error.toLowerCase()
  
  if (lowerError.includes('invalid') || lowerError.includes('url')) {
    return VideoImportErrorCode.INVALID_URL
  }
  if (lowerError.includes('unsupported') || lowerError.includes('platform')) {
    return VideoImportErrorCode.UNSUPPORTED_PLATFORM
  }
  if (lowerError.includes('private') || lowerError.includes('restricted')) {
    return VideoImportErrorCode.PRIVATE_CONTENT
  }
  
  return VideoImportErrorCode.UNKNOWN_ERROR
}

/**
 * Categorize extraction errors into specific error codes
 */
function categorizeExtractionError(error: string): VideoImportErrorCode {
  const lowerError = error.toLowerCase()
  
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return VideoImportErrorCode.TIMEOUT
  }
  if (lowerError.includes('private') || lowerError.includes('unavailable')) {
    return VideoImportErrorCode.CONTENT_UNAVAILABLE
  }
  if (lowerError.includes('rate limit') || lowerError.includes('too many requests')) {
    return VideoImportErrorCode.RATE_LIMITED
  }
  if (lowerError.includes('download') || lowerError.includes('network')) {
    return VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED
  }
  if (lowerError.includes('audio') || lowerError.includes('extract')) {
    return VideoImportErrorCode.AUDIO_EXTRACTION_FAILED
  }
  if (lowerError.includes('quota') || lowerError.includes('exceeded')) {
    return VideoImportErrorCode.QUOTA_EXCEEDED
  }
  
  return VideoImportErrorCode.UNKNOWN_ERROR
}

/**
 * Check if an error is retryable based on error code and message
 */
function isErrorRetryable(errorCode: VideoImportErrorCode, errorMessage: string): boolean {
  // Retryable errors
  const retryableErrors = [
    VideoImportErrorCode.TIMEOUT,
    VideoImportErrorCode.RATE_LIMITED,
    VideoImportErrorCode.UNKNOWN_ERROR
  ]
  
  if (retryableErrors.includes(errorCode)) {
    return true
  }
  
  // Check for transient network errors in message
  const lowerMessage = errorMessage.toLowerCase()
  const transientKeywords = [
    'network', 'connection', 'temporary', 'server error', 
    '503', '502', '500', 'timeout', 'reset'
  ]
  
  return transientKeywords.some(keyword => lowerMessage.includes(keyword))
}

/**
 * Get user-friendly suggestions for error codes
 */
function getSuggestionsForErrorCode(errorCode: VideoImportErrorCode): string[] {
  const suggestions: Record<VideoImportErrorCode, string[]> = {
    [VideoImportErrorCode.INVALID_URL]: [
      'Check that the URL is complete and properly formatted',
      'Ensure the URL is from a supported platform (Instagram, TikTok, YouTube)',
      'Try copying the URL directly from the platform'
    ],
    [VideoImportErrorCode.UNSUPPORTED_PLATFORM]: [
      'Only Instagram, TikTok, and YouTube Shorts are supported',
      'Make sure the URL is a video link, not a profile or post'
    ],
    [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: [
      'Check if the video is publicly accessible',
      'Verify the video still exists on the platform',
      'Try again in a few minutes'
    ],
    [VideoImportErrorCode.AUDIO_EXTRACTION_FAILED]: [
      'The video format may not be supported',
      'Check if the video has audio content',
      'Try a different video'
    ],
    [VideoImportErrorCode.TRANSCRIPTION_FAILED]: [
      'The audio quality may be too poor for transcription',
      'Try a video with clearer speech',
      'Check if the video has audible speech content'
    ],
    [VideoImportErrorCode.NO_SPEECH_DETECTED]: [
      'Ensure the video contains spoken cooking instructions',
      'Check that the video has audio',
      'Try a video with clearer speech'
    ],
    [VideoImportErrorCode.RECIPE_STRUCTURING_FAILED]: [
      'Make sure the video is about cooking or recipes',
      'Try a video with clearer recipe instructions',
      'Check that ingredients and steps are mentioned in the video'
    ],
    [VideoImportErrorCode.TIMEOUT]: [
      'Try a shorter video (under 5 minutes)',
      'Check your internet connection',
      'Try again later when servers are less busy'
    ],
    [VideoImportErrorCode.RATE_LIMITED]: [
      'Wait a few minutes before trying again',
      'You may have hit a rate limit - try again later'
    ],
    [VideoImportErrorCode.PRIVATE_CONTENT]: [
      'Make sure the video is publicly accessible',
      'Check if you need to be logged in to view the video',
      'Try a different public video'
    ],
    [VideoImportErrorCode.CONTENT_UNAVAILABLE]: [
      'The video may have been deleted or made private',
      'Check if the link is still valid',
      'Try a different video'
    ],
    [VideoImportErrorCode.QUOTA_EXCEEDED]: [
      'Processing quota has been exceeded',
      'Try again later or contact support'
    ],
    [VideoImportErrorCode.UNKNOWN_ERROR]: [
      'Try again in a few minutes',
      'If the problem persists, contact support'
    ]
  }
  
  return suggestions[errorCode] || suggestions[VideoImportErrorCode.UNKNOWN_ERROR]
}

/**
 * Create a standardized error result
 */
function createErrorResult(
  error: string,
  errorCode: VideoImportErrorCode,
  warnings: string[],
  startTime: number,
  retryable: boolean = false,
  retryCount: number = 0
): AudioExtractionResult {
  return {
    success: false,
    error,
    errorCode,
    warnings,
    retryable,
    suggestions: getSuggestionsForErrorCode(errorCode),
    retryCount,
    processingTime: Date.now() - startTime
  }
}

/**
 * Backup audio extraction method using alternative approach
 */
async function performBackupAudioExtraction(
  url: string,
  outputPath: string,
  videoInfo: VideoInfo,
  options: Required<AudioExtractionOptions>,
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<AudioExtractionResult> {
  // Simplified backup extraction with minimal arguments
  const args = [
    url,
    '--extract-audio',
    '--audio-format', 'wav',
    '--output', outputPath.replace(/\.[^.]+$/, '.%(ext)s'),
    '--no-playlist',
    '--ignore-errors',
    '--quiet'
  ]

  return new Promise((resolve) => {
    const child = spawn('yt-dlp', args)
    const warnings: string[] = ['Used simplified backup extraction']

    let hasOutput = false
    
    child.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('ERROR')) {
        warnings.push(`Backup extraction warning: ${output.trim()}`)
      } else {
        hasOutput = true
        onProgress?.({
          stage: 'extracting',
          message: 'Backup extraction in progress...',
          progress: 50
        })
      }
    })

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(outputPath)
          if (stats.size > 0) {
            resolve({
              success: true,
              audioPath: outputPath,
              warnings
            })
            return
          }
        } catch (error) {
          // File doesn't exist or other error
        }
      }

      resolve({
        success: false,
        error: `Backup extraction failed with code ${code}`,
        warnings
      })
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Backup extraction process error: ${error.message}`,
        warnings
      })
    })

    // Shorter timeout for backup method
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM')
        resolve({
          success: false,
          error: 'Backup extraction timed out',
          warnings
        })
      }
    }, 60000) // 1 minute timeout
  })
} 