/**
 * Audio Extractor
 * Handles audio extraction from video URLs using yt-dlp with platform-specific optimizations
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { processVideoUrl, type VideoInfo, type SupportedPlatform, getPlatformProcessingOptions } from '@/lib/video-processor'
import { withTempFile } from '@/lib/temp-file-manager'

export interface AudioExtractionOptions {
  outputFormat?: 'wav' | 'mp3' | 'aac'
  sampleRate?: number
  maxDuration?: number
  quality?: 'best' | 'worst' | 'medium'
  timeout?: number
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
  warnings?: string[]
}

export interface AudioExtractionProgress {
  stage: 'initializing' | 'downloading' | 'extracting' | 'finalizing' | 'completed' | 'failed'
  progress?: number
  message?: string
  eta?: string
}

/**
 * Extract audio from video URL with platform-specific optimizations
 */
export async function extractAudioFromVideo(
  url: string,
  options: AudioExtractionOptions = {},
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<AudioExtractionResult> {
  const warnings: string[] = []
  
  try {
    onProgress?.({ stage: 'initializing', message: 'Validating video URL...' })

    // Step 1: Validate and process video URL
    const videoProcessResult = await processVideoUrl(url)
    if (!videoProcessResult.isValid || !videoProcessResult.videoInfo) {
      return {
        success: false,
        error: videoProcessResult.error || 'Invalid video URL',
        warnings
      }
    }

    const videoInfo = videoProcessResult.videoInfo
    const platformOptions = getPlatformProcessingOptions(videoInfo.platform)

    // Step 2: Configure extraction options based on platform
    const extractionOptions = {
      outputFormat: options.outputFormat || platformOptions.audioFormat as 'wav',
      sampleRate: options.sampleRate || 16000, // Optimal for speech recognition
      maxDuration: options.maxDuration || platformOptions.maxDuration,
      quality: options.quality || 'worst', // Prioritize speed over quality for speech
      timeout: options.timeout || 120000 // 2 minutes timeout
    }

    onProgress?.({ 
      stage: 'downloading', 
      message: `Extracting audio from ${videoInfo.platform} video...`,
      progress: 10
    })

    // Step 3: Extract audio using temporary file management
    const audioResult = await withTempFile(
      extractionOptions.outputFormat,
      async (tempAudioPath: string) => {
        return await performAudioExtraction(
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
        success: false,
        error: audioResult.error,
        warnings: warnings.concat(audioResult.warnings || [])
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
      warnings
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({ 
      stage: 'failed', 
      message: `Audio extraction failed: ${errorMessage}` 
    })

    return {
      success: false,
      error: `Audio extraction failed: ${errorMessage}`,
      warnings
    }
  }
}

/**
 * Perform the actual audio extraction using yt-dlp
 */
async function performAudioExtraction(
  url: string,
  outputPath: string,
  videoInfo: VideoInfo,
  options: Required<AudioExtractionOptions>,
  onProgress?: (progress: AudioExtractionProgress) => void
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