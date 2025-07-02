/**
 * Video Processor
 * Handles video URL detection, platform-specific processing, and metadata extraction
 */

import { validateVideoUrl, type VideoUrlValidationResult } from '@/lib/video-url-validator'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'

export type SupportedPlatform = 'instagram' | 'tiktok' | 'youtube'

export interface VideoInfo {
  platform: SupportedPlatform
  videoId: string
  originalUrl: string
  normalizedUrl: string
  metadata?: {
    title?: string
    description?: string
    duration?: number
    thumbnail?: string
    uploader?: string
    uploadDate?: string
  }
}

export interface VideoDetectionResult {
  isSupported: boolean
  platform?: SupportedPlatform
  videoInfo?: VideoInfo
  error?: string
}

/**
 * Platform-specific URL patterns and extraction logic
 */
const PLATFORM_CONFIGS = {
  instagram: {
    name: 'Instagram',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^/]+\/(?:p|reel)\/([A-Za-z0-9_-]+)/
    ],
    extractVideoId: (url: string): string | null => {
      const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/)
      return match ? match[1] : null
    },
    getApiUrl: (videoId: string): string => `https://www.instagram.com/p/${videoId}/`,
    maxDuration: 600 // 10 minutes max for Instagram
  },
  
  tiktok: {
    name: 'TikTok',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^/]+\/video\/(\d+)/,
      /(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/,
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)/
    ],
    extractVideoId: (url: string): string | null => {
      let match = url.match(/\/video\/(\d+)/)
      if (match) return match[1]
      
      match = url.match(/\/([A-Za-z0-9]+)$/)
      return match ? match[1] : null
    },
    getApiUrl: (videoId: string): string => `https://www.tiktok.com/@user/video/${videoId}`,
    maxDuration: 600 // 10 minutes max for TikTok
  },
  
  youtube: {
    name: 'YouTube',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]+)/,
      /(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]+)/,
      /(?:https?:\/\/)?(?:m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]+)/
    ],
    extractVideoId: (url: string): string | null => {
      let match = url.match(/\/shorts\/([A-Za-z0-9_-]+)/)
      if (match) return match[1]
      
      match = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
      return match ? match[1] : null
    },
    getApiUrl: (videoId: string): string => `https://www.youtube.com/shorts/${videoId}`,
    maxDuration: 60 // 60 seconds max for YouTube Shorts
  }
} as const

/**
 * Detect video platform and extract basic information
 */
export function detectVideoPlatform(url: string): VideoDetectionResult {
  // First validate the URL using existing validator
  const validation = validateVideoUrl(url)
  
  if (!validation.isValid) {
    return {
      isSupported: false,
      error: validation.error || 'Invalid video URL'
    }
  }

  const platform = validation.platform as SupportedPlatform
  if (!platform) {
    return {
      isSupported: false,
      error: 'Unsupported platform'
    }
  }

  const config = PLATFORM_CONFIGS[platform]
  const videoId = config.extractVideoId(url)
  
  if (!videoId) {
    return {
      isSupported: false,
      error: `Could not extract video ID from ${config.name} URL`
    }
  }

  const videoInfo: VideoInfo = {
    platform,
    videoId,
    originalUrl: url,
    normalizedUrl: validation.details?.normalizedUrl || url,
    metadata: {}
  }

  return {
    isSupported: true,
    platform,
    videoInfo
  }
}

/**
 * Extract video metadata using yt-dlp
 */
export async function extractVideoMetadata(url: string): Promise<VideoInfo['metadata']> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-json',
      '--no-download',
      '--no-playlist'
    ]

    const child = spawn('yt-dlp', args)
    
    let output = ''
    let errorOutput = ''
    
    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`yt-dlp metadata extraction failed: ${errorOutput}`)
        // Don't fail completely, return empty metadata
        resolve({})
        return
      }

      try {
        const metadata = JSON.parse(output)
        resolve({
          title: metadata.title || undefined,
          description: metadata.description?.substring(0, 500) || undefined, // Truncate description
          duration: metadata.duration || undefined,
          thumbnail: metadata.thumbnail || undefined,
          uploader: metadata.uploader || metadata.channel || undefined,
          uploadDate: metadata.upload_date || undefined
        })
      } catch (parseError) {
        console.warn('Failed to parse yt-dlp metadata:', parseError)
        resolve({})
      }
    })

    child.on('error', (err) => {
      console.warn('yt-dlp metadata extraction error:', err)
      resolve({}) // Return empty metadata instead of failing
    })
  })
}

/**
 * Check if video URL points to supported short-form content
 */
export function isShortFormVideo(url: string): boolean {
  const detection = detectVideoPlatform(url)
  
  if (!detection.isSupported || !detection.videoInfo) {
    return false
  }

  const { platform } = detection.videoInfo
  const config = PLATFORM_CONFIGS[platform]
  
  // For Instagram and TikTok, assume short-form
  if (platform === 'instagram' || platform === 'tiktok') {
    return true
  }
  
  // For YouTube, check if it's explicitly a Shorts URL
  if (platform === 'youtube') {
    return url.includes('/shorts/')
  }
  
  return false
}

/**
 * Get platform-specific processing options
 */
export function getPlatformProcessingOptions(platform: SupportedPlatform): {
  maxDuration: number
  audioFormat: string
  qualityPreference: string[]
} {
  const config = PLATFORM_CONFIGS[platform]
  
  return {
    maxDuration: config.maxDuration,
    audioFormat: 'wav',
    qualityPreference: platform === 'youtube' 
      ? ['worst[height<=720]', 'worst'] 
      : ['worst[height<=480]', 'worst'] // Lower quality for faster processing
  }
}

/**
 * Enhanced video URL detection with comprehensive validation
 */
export async function processVideoUrl(url: string): Promise<{
  isValid: boolean
  videoInfo?: VideoInfo
  error?: string
  suggestions?: string[]
}> {
  try {
    // Step 1: Basic URL detection
    const detection = detectVideoPlatform(url)
    
    if (!detection.isSupported) {
      return {
        isValid: false,
        error: detection.error,
        suggestions: [
          'Ensure the URL is from Instagram, TikTok, or YouTube Shorts',
          'Check that the URL is complete and properly formatted',
          'Try copying the URL directly from the platform'
        ]
      }
    }

    const { videoInfo } = detection
    if (!videoInfo) {
      return {
        isValid: false,
        error: 'Failed to extract video information',
        suggestions: ['Verify the video URL is correct and accessible']
      }
    }

    // Step 2: Check if it's short-form content
    if (!isShortFormVideo(url)) {
      return {
        isValid: false,
        error: 'Only short-form video content is supported',
        suggestions: [
          'Use Instagram Reels or Posts instead of IGTV',
          'Use TikTok videos instead of live streams',
          'Use YouTube Shorts instead of regular videos'
        ]
      }
    }

    // Step 3: Extract additional metadata (non-blocking)
    try {
      const metadata = await extractVideoMetadata(url)
      videoInfo.metadata = { ...videoInfo.metadata, ...metadata }
    } catch (metadataError) {
      console.warn('Metadata extraction failed, continuing without metadata:', metadataError)
    }

    return {
      isValid: true,
      videoInfo
    }

  } catch (error) {
    return {
      isValid: false,
      error: `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestions: ['Please try again or contact support if the problem persists']
    }
  }
}

/**
 * Batch process multiple video URLs
 */
export async function processMultipleVideoUrls(urls: string[]): Promise<Array<{
  url: string
  result: Awaited<ReturnType<typeof processVideoUrl>>
}>> {
  const results = await Promise.allSettled(
    urls.map(async (url) => ({
      url,
      result: await processVideoUrl(url)
    }))
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        url: urls[index],
        result: {
          isValid: false,
          error: `Processing failed: ${result.reason}`,
          suggestions: ['Please try again with a valid video URL']
        }
      }
    }
  })
}

/**
 * Get user-friendly platform display name
 */
export function getPlatformDisplayName(platform: SupportedPlatform): string {
  return PLATFORM_CONFIGS[platform].name
}

/**
 * Extract ingredients from video description (if available)
 */
export function extractIngredientsFromDescription(description?: string): string[] {
  if (!description) return []

  const ingredients: string[] = []
  const lines = description.split('\n')
  
  // Look for common ingredient patterns
  const ingredientPatterns = [
    /^[-•*]\s*(.+)$/gm, // Bullet points
    /^\d+\.?\s*(.+)$/gm, // Numbered lists
    /(?:ingredients?|recipe):?\s*(.+)/gi, // "Ingredients:" sections
  ]

  for (const pattern of ingredientPatterns) {
    const matches = description.matchAll(pattern)
    for (const match of matches) {
      const ingredient = match[1]?.trim()
      if (ingredient && ingredient.length > 2 && ingredient.length < 100) {
        ingredients.push(ingredient)
      }
    }
  }

  // Remove duplicates and return first 20 ingredients max
  return [...new Set(ingredients)].slice(0, 20)
} 