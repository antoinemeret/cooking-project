/**
 * Video URL Validator
 * Comprehensive validation for social media video URLs
 */

export interface VideoUrlValidationResult {
  isValid: boolean
  platform?: 'instagram' | 'tiktok' | 'youtube'
  error?: string
  details?: {
    url: string
    normalizedUrl?: string
    platform?: string
    videoId?: string
  }
}

export interface VideoUrlValidationOptions {
  allowPrivate?: boolean
  maxUrlLength?: number
  checkReachability?: boolean
}

/**
 * Platform-specific URL patterns
 */
const PLATFORM_PATTERNS = {
  instagram: [
    /^https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+\/?/,
    /^https?:\/\/(www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+\/?/,
    /^https?:\/\/(www\.)?instagram\.com\/[^/]+\/p\/[A-Za-z0-9_-]+\/?/,
    /^https?:\/\/(www\.)?instagram\.com\/[^/]+\/reel\/[A-Za-z0-9_-]+\/?/
  ],
  tiktok: [
    /^https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/,
    /^https?:\/\/(vm|vt)\.tiktok\.com\/[A-Za-z0-9]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[A-Za-z0-9]+/
  ],
  youtube: [
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/,
    /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+.*[&#]t=\d+s?/,
    /^https?:\/\/(m\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/
  ]
}

/**
 * Security patterns to block
 */
const SECURITY_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /file:/i,
  /ftp:/i,
  /<script/i,
  /vbscript:/i,
  /onload/i,
  /onerror/i
]

/**
 * Validate basic URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Check for security threats in URL
 */
function hasSecurityThreats(url: string): boolean {
  return SECURITY_PATTERNS.some(pattern => pattern.test(url))
}

/**
 * Normalize URL for consistent processing
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'ref', 'source', '_r'
    ]
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param)
    })

    // Ensure https
    urlObj.protocol = 'https:'
    
    // Remove trailing slash
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/'
    
    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * Extract video ID from URL
 */
function extractVideoId(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url)
    
    switch (platform) {
      case 'instagram':
        const igMatch = url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/)
        return igMatch ? igMatch[2] : null
        
      case 'tiktok':
        const ttMatch = url.match(/\/video\/(\d+)/) || url.match(/\/([A-Za-z0-9]+)$/)
        return ttMatch ? ttMatch[1] : null
        
      case 'youtube':
        const ytMatch = url.match(/\/shorts\/([A-Za-z0-9_-]+)/) || 
                      url.match(/youtu\.be\/([A-Za-z0-9_-]+)/) ||
                      url.match(/[?&]v=([A-Za-z0-9_-]+)/)
        return ytMatch ? ytMatch[1] : null
        
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): 'instagram' | 'tiktok' | 'youtube' | null {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return platform as 'instagram' | 'tiktok' | 'youtube'
    }
  }
  return null
}

/**
 * Validate URL length
 */
function validateUrlLength(url: string, maxLength: number = 2048): boolean {
  return url.length <= maxLength
}

/**
 * Check if URL appears to be from a private/restricted account
 */
function appearsPrivate(url: string): boolean {
  // Basic heuristics for private content indicators
  const privateIndicators = [
    /\/private\//i,
    /\/restricted\//i,
    /[?&]private=true/i,
    /[?&]access=private/i
  ]
  
  return privateIndicators.some(pattern => pattern.test(url))
}

/**
 * Main validation function
 */
export function validateVideoUrl(
  url: string, 
  options: VideoUrlValidationOptions = {}
): VideoUrlValidationResult {
  const {
    allowPrivate = false,
    maxUrlLength = 2048,
    checkReachability = false
  } = options

  // Basic validation
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required and must be a string'
    }
  }

  if (!validateUrlLength(url, maxUrlLength)) {
    return {
      isValid: false,
      error: `URL exceeds maximum length of ${maxUrlLength} characters`
    }
  }

  if (!isValidUrl(url)) {
    return {
      isValid: false,
      error: 'Invalid URL format. Must be a valid HTTP or HTTPS URL'
    }
  }

  if (hasSecurityThreats(url)) {
    return {
      isValid: false,
      error: 'URL contains potential security threats'
    }
  }

  // Platform detection
  const platform = detectPlatform(url)
  if (!platform) {
    return {
      isValid: false,
      error: 'URL must be from Instagram, TikTok, or YouTube Shorts. Supported formats:\n' +
             '• Instagram: instagram.com/p/... or instagram.com/reel/...\n' +
             '• TikTok: tiktok.com/@user/video/... or vm.tiktok.com/...\n' +
             '• YouTube: youtube.com/shorts/... or youtu.be/...'
    }
  }

  // Privacy check
  if (!allowPrivate && appearsPrivate(url)) {
    return {
      isValid: false,
      error: 'Private or restricted content URLs are not supported'
    }
  }

  // Extract details
  const normalizedUrl = normalizeUrl(url)
  const videoId = extractVideoId(url, platform)

  return {
    isValid: true,
    platform,
    details: {
      url,
      normalizedUrl,
      platform,
      videoId: videoId || undefined
    }
  }
}

/**
 * Quick validation for API routes
 */
export function isValidVideoUrl(url: string): boolean {
  return validateVideoUrl(url).isValid
}

/**
 * Get user-friendly platform name
 */
export function getPlatformDisplayName(platform: string): string {
  const displayNames = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube'
  }
  return displayNames[platform as keyof typeof displayNames] || platform
}

/**
 * Validate multiple URLs
 */
export function validateVideoUrls(urls: string[]): VideoUrlValidationResult[] {
  return urls.map(url => validateVideoUrl(url))
}

/**
 * Extract all video URLs from text
 */
export function extractVideoUrls(text: string): string[] {
  const allPatterns = Object.values(PLATFORM_PATTERNS).flat()
  const urls: string[] = []
  
  for (const pattern of allPatterns) {
    const matches = text.match(new RegExp(pattern.source, 'g'))
    if (matches) {
      urls.push(...matches)
    }
  }
  
  return Array.from(new Set(urls)) // Remove duplicates
} 