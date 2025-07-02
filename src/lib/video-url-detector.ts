/**
 * Video URL Detection Utility
 * Detects if a URL is from a video platform that should use the video import API
 */

export type VideoFormats = 'instagram' | 'tiktok' | 'youtube' | null

export interface VideoUrlDetection {
  isVideoUrl: boolean
  platform: VideoFormats
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Detect if a URL is from a supported video platform
 */
export function detectVideoUrl(url: string): VideoUrlDetection {
  if (!url || typeof url !== 'string') {
    return { isVideoUrl: false, platform: null, confidence: 'low' }
  }

  // Clean and normalize URL
  const normalizedUrl = url.trim().toLowerCase()

  // Instagram patterns
  const instagramPatterns = [
    /instagram\.com\/reel\//,
    /instagram\.com\/p\//,
    /instagram\.com\/tv\//,
    /instagr\.am\/p\//,
  ]

  for (const pattern of instagramPatterns) {
    if (pattern.test(normalizedUrl)) {
      return { isVideoUrl: true, platform: 'instagram', confidence: 'high' }
    }
  }

  // TikTok patterns
  const tiktokPatterns = [
    /tiktok\.com\/@[\w\.-]+\/video\/\d+/,
    /tiktok\.com\/v\/\d+/,
    /vm\.tiktok\.com\//,
    /vt\.tiktok\.com\//,
  ]

  for (const pattern of tiktokPatterns) {
    if (pattern.test(normalizedUrl)) {
      return { isVideoUrl: true, platform: 'tiktok', confidence: 'high' }
    }
  }

  // YouTube patterns (focusing on Shorts and short videos)
  const youtubePatterns = [
    /youtube\.com\/shorts\//,
    /youtu\.be\//,
    /youtube\.com\/watch\?v=[\w-]+.*[&#]t=\d+s?/, // Short clips with timestamps
    /m\.youtube\.com\/shorts\//,
  ]

  for (const pattern of youtubePatterns) {
    if (pattern.test(normalizedUrl)) {
      return { isVideoUrl: true, platform: 'youtube', confidence: 'high' }
    }
  }

  // Generic video file extensions (lower confidence)
  const videoExtensions = /\.(mp4|mov|avi|mkv|webm|m4v)($|\?)/
  if (videoExtensions.test(normalizedUrl)) {
    return { isVideoUrl: true, platform: null, confidence: 'medium' }
  }

  return { isVideoUrl: false, platform: null, confidence: 'low' }
}

/**
 * Get human-readable platform name
 */
export function getPlatformDisplayName(platform: VideoFormats): string {
  const displayNames = {
    instagram: 'Instagram',
    tiktok: 'TikTok', 
    youtube: 'YouTube',
  }
  
  return platform ? displayNames[platform] : 'Video'
}

/**
 * Get platform-specific help text
 */
export function getPlatformHelpText(platform: VideoFormats): string {
  const helpTexts = {
    instagram: 'Supports Instagram Reels, IGTV, and video posts',
    tiktok: 'Supports TikTok videos and short clips',
    youtube: 'Supports YouTube Shorts and video clips',
  }
  
  return platform ? helpTexts[platform] : 'Supports video content from social media platforms'
} 