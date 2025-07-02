/**
 * User-Friendly Error System
 * Converts technical errors into helpful, actionable messages for users
 */

import { VideoImportErrorCode } from '@/types/video-import'

export interface UserFriendlyError {
  title: string
  message: string
  suggestions: string[]
  severity: 'low' | 'medium' | 'high'
  canRetry: boolean
  estimatedFixTime: string
  helpfulLinks?: Array<{
    text: string
    url: string
  }>
  technicalDetails?: string
}

export interface ErrorContext {
  platform?: string
  videoUrl?: string
  processingStage?: string
  processingTime?: number
  retryCount?: number
  userAgent?: string
  networkCondition?: 'good' | 'poor' | 'unknown'
  systemLoad?: 'low' | 'medium' | 'high'
}

/**
 * Generate user-friendly error messages based on error codes and context
 */
export function createUserFriendlyError(
  errorCode: VideoImportErrorCode,
  originalError: string,
  context?: ErrorContext
): UserFriendlyError {
  const baseError = getBaseErrorInfo(errorCode)
  
  // Enhance error based on context
  const enhancedError = enhanceErrorWithContext(baseError, originalError, context)
  
  // Add platform-specific guidance
  if (context?.platform) {
    enhancedError.suggestions = enhancePlatformSpecificSuggestions(
      enhancedError.suggestions, 
      context.platform, 
      errorCode
    )
  }
  
  // Add retry guidance based on attempt history
  if (context?.retryCount !== undefined) {
    enhancedError.suggestions = enhanceRetryGuidance(
      enhancedError.suggestions,
      context.retryCount,
      errorCode
    )
  }
  
  // Add performance context
  if (context?.processingTime) {
    enhancedError.suggestions = enhancePerformanceGuidance(
      enhancedError.suggestions,
      context.processingTime,
      errorCode
    )
  }
  
  return enhancedError
}

/**
 * Get base error information for each error code
 */
function getBaseErrorInfo(errorCode: VideoImportErrorCode): UserFriendlyError {
  const errorMap: Record<VideoImportErrorCode, UserFriendlyError> = {
    [VideoImportErrorCode.INVALID_URL]: {
      title: '🔗 Invalid Video URL',
      message: 'The video URL you provided is not valid or properly formatted.',
      suggestions: [
        'Copy the video URL directly from your browser\'s address bar',
        'Make sure the URL includes "http://" or "https://"',
        'Check that the URL is complete and not truncated',
        'Verify the video is from Instagram, TikTok, or YouTube Shorts'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '< 1 minute',
      helpfulLinks: [
        { text: 'How to copy video URLs', url: '#url-guide' }
      ]
    },

    [VideoImportErrorCode.UNSUPPORTED_PLATFORM]: {
      title: '🚫 Platform Not Supported',
      message: 'We currently only support videos from Instagram, TikTok, and YouTube Shorts.',
      suggestions: [
        'Use a video from Instagram Reels, TikTok, or YouTube Shorts',
        'If this is from a supported platform, check the URL format',
        'Consider downloading the video and uploading it to a supported platform'
      ],
      severity: 'high',
      canRetry: false,
      estimatedFixTime: '2-3 minutes',
      helpfulLinks: [
        { text: 'Supported platforms list', url: '#platforms' }
      ]
    },

    [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: {
      title: '📥 Can\'t Access Video',
      message: 'We couldn\'t download the video. It might be private, deleted, or temporarily unavailable.',
      suggestions: [
        'Check if the video is still available by visiting the link',
        'Make sure the video is set to public (not private)',
        'Try again in a few minutes - the platform might be experiencing issues',
        'Contact the video creator if it\'s their content'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '2-5 minutes',
      helpfulLinks: [
        { text: 'Privacy settings guide', url: '#privacy' }
      ]
    },

    [VideoImportErrorCode.AUDIO_EXTRACTION_FAILED]: {
      title: '🔊 Audio Processing Issue',
      message: 'We couldn\'t extract clear audio from this video.',
      suggestions: [
        'Make sure the video has audible speech or narration',
        'Try a video with clearer audio quality',
        'Check that your device volume is not muted (for testing)',
        'Use videos recorded in quieter environments'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '1-2 minutes'
    },

    [VideoImportErrorCode.TRANSCRIPTION_FAILED]: {
      title: '🎤 Speech Recognition Issue',
      message: 'We had trouble understanding the spoken content in this video.',
      suggestions: [
        'Try videos with clear, distinct speech',
        'Avoid videos with heavy background music or noise',
        'Use videos where the speaker talks at a normal pace',
        'Check if the video has actual cooking instructions (not just music)'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '1-2 minutes',
      helpfulLinks: [
        { text: 'Best practices for video content', url: '#video-tips' }
      ]
    },

    [VideoImportErrorCode.NO_SPEECH_DETECTED]: {
      title: '🔇 No Speech Found',
      message: 'We couldn\'t find any spoken instructions in this video.',
      suggestions: [
        'Make sure the video contains verbal cooking instructions',
        'Check if the video has audio (not a silent/muted video)',
        'Try videos where someone explains the recipe steps out loud',
        'Avoid videos that only have background music or sounds'
      ],
      severity: 'high',
      canRetry: false,
      estimatedFixTime: '1-2 minutes'
    },

    [VideoImportErrorCode.RECIPE_STRUCTURING_FAILED]: {
      title: '🍳 Recipe Content Issue',
      message: 'We found speech but couldn\'t identify clear cooking instructions.',
      suggestions: [
        'Use videos that specifically show cooking or recipe preparation',
        'Try videos where ingredients and steps are mentioned clearly',
        'Avoid videos that are mainly reviews, reactions, or general food content',
        'Look for videos with step-by-step cooking instructions'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '2-3 minutes',
      helpfulLinks: [
        { text: 'What makes a good recipe video', url: '#recipe-tips' }
      ]
    },

    [VideoImportErrorCode.TIMEOUT]: {
      title: '⏱️ Processing Took Too Long',
      message: 'The video processing is taking longer than expected and was stopped.',
      suggestions: [
        'Try a shorter video (under 3 minutes works best)',
        'Check your internet connection speed',
        'Try again during less busy times',
        'Use videos with simpler content for faster processing'
      ],
      severity: 'low',
      canRetry: true,
      estimatedFixTime: '< 1 minute'
    },

    [VideoImportErrorCode.RATE_LIMITED]: {
      title: '⏸️ Too Many Requests',
      message: 'You\'ve made too many requests recently. Please wait a moment.',
      suggestions: [
        'Wait 2-3 minutes before trying again',
        'Avoid submitting multiple videos at the same time',
        'Consider processing one video at a time for better results'
      ],
      severity: 'low',
      canRetry: true,
      estimatedFixTime: '2-3 minutes'
    },

    [VideoImportErrorCode.PRIVATE_CONTENT]: {
      title: '🔒 Private Video',
      message: 'This video is private or restricted and we can\'t access it.',
      suggestions: [
        'Make sure the video is publicly viewable',
        'Check if you need to be logged in to view the video',
        'Ask the video creator to make it public',
        'Try a different public video instead'
      ],
      severity: 'high',
      canRetry: false,
      estimatedFixTime: '5-10 minutes'
    },

    [VideoImportErrorCode.CONTENT_UNAVAILABLE]: {
      title: '❌ Video Not Found',
      message: 'The video has been deleted, moved, or is no longer available.',
      suggestions: [
        'Check if the video link still works in your browser',
        'The video might have been deleted by the creator or platform',
        'Try finding the same recipe from a different creator',
        'Look for similar content that\'s still available'
      ],
      severity: 'high',
      canRetry: false,
      estimatedFixTime: '5-10 minutes'
    },

    [VideoImportErrorCode.QUOTA_EXCEEDED]: {
      title: '📊 Processing Limit Reached',
      message: 'We\'ve reached our daily processing limit. Please try again later.',
      suggestions: [
        'Try again after a few hours or tomorrow',
        'Consider upgrading to a premium plan for higher limits',
        'Process your most important videos first'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: 'Few hours'
    },

    [VideoImportErrorCode.UNKNOWN_ERROR]: {
      title: '🤔 Something Went Wrong',
      message: 'We encountered an unexpected issue while processing your video.',
      suggestions: [
        'Try again - this might be a temporary issue',
        'Check if the video works with our supported formats',
        'Try a different video to see if the issue persists',
        'Contact support if this keeps happening'
      ],
      severity: 'medium',
      canRetry: true,
      estimatedFixTime: '1-2 minutes',
      helpfulLinks: [
        { text: 'Contact Support', url: '#support' }
      ]
    }
  }

  return errorMap[errorCode] || errorMap[VideoImportErrorCode.UNKNOWN_ERROR]
}

/**
 * Enhance error message based on processing context
 */
function enhanceErrorWithContext(
  baseError: UserFriendlyError,
  originalError: string,
  context?: ErrorContext
): UserFriendlyError {
  const enhanced = { ...baseError }
  
  // Add technical details if requested
  enhanced.technicalDetails = originalError
  
  // Adjust message based on processing stage
  if (context?.processingStage) {
    enhanced.message += ` (Failed during ${context.processingStage} stage)`
  }
  
  // Adjust severity based on system load
  if (context?.systemLoad === 'high') {
    enhanced.suggestions.unshift('System is under high load - try again in a few minutes')
    if (enhanced.severity === 'low') {
      enhanced.severity = 'medium'
    }
  }
  
  // Adjust suggestions for poor network conditions
  if (context?.networkCondition === 'poor') {
    enhanced.suggestions.unshift('Check your internet connection stability')
    enhanced.estimatedFixTime = enhanced.estimatedFixTime.includes('minute') 
      ? enhanced.estimatedFixTime.replace(/\d+/, (match) => (parseInt(match) * 2).toString())
      : enhanced.estimatedFixTime
  }
  
  return enhanced
}

/**
 * Add platform-specific suggestions
 */
function enhancePlatformSpecificSuggestions(
  baseSuggestions: string[],
  platform: string,
  errorCode: VideoImportErrorCode
): string[] {
  const platformSuggestions: Record<string, Record<VideoImportErrorCode, string[]>> = {
    instagram: {
      [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: [
        'Make sure the Instagram Reel is not from a private account',
        'Try copying the URL from Instagram\'s mobile app or website'
      ],
      [VideoImportErrorCode.AUDIO_EXTRACTION_FAILED]: [
        'Instagram Reels sometimes have low audio - try videos with clear narration'
      ]
    },
    tiktok: {
      [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: [
        'TikTok videos might be region-restricted - check if you can view it normally',
        'Some TikTok videos require login - make sure it\'s publicly accessible'
      ],
      [VideoImportErrorCode.TRANSCRIPTION_FAILED]: [
        'TikTok videos often have background music - look for cooking tutorials with clear speech'
      ]
    },
    youtube: {
      [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: [
        'Make sure the YouTube Short is not age-restricted or region-locked',
        'Try using the full YouTube URL, not the shortened youtu.be format'
      ],
      [VideoImportErrorCode.RECIPE_STRUCTURING_FAILED]: [
        'YouTube Shorts work best when they show actual cooking steps, not just final results'
      ]
    }
  }
  
  const platformSpecific = platformSuggestions[platform.toLowerCase()]?.[errorCode] || []
  return [...platformSpecific, ...baseSuggestions]
}

/**
 * Add retry-specific guidance
 */
function enhanceRetryGuidance(
  baseSuggestions: string[],
  retryCount: number,
  errorCode: VideoImportErrorCode
): string[] {
  if (retryCount === 0) {
    return baseSuggestions
  }
  
  const retryGuidance: string[] = []
  
  if (retryCount === 1) {
    retryGuidance.push('This is your second attempt - consider trying a different video')
  } else if (retryCount === 2) {
    retryGuidance.push('Multiple attempts failed - the issue might be with this specific video')
  } else if (retryCount >= 3) {
    retryGuidance.push('After several attempts, try a completely different video or contact support')
  }
  
  // Add error-specific retry guidance
  if (errorCode === VideoImportErrorCode.TIMEOUT && retryCount > 0) {
    retryGuidance.push('Repeated timeouts suggest using a shorter or simpler video')
  }
  
  if (errorCode === VideoImportErrorCode.TRANSCRIPTION_FAILED && retryCount > 1) {
    retryGuidance.push('Transcription keeps failing - try videos with very clear speech')
  }
  
  return [...retryGuidance, ...baseSuggestions]
}

/**
 * Add performance-based guidance
 */
function enhancePerformanceGuidance(
  baseSuggestions: string[],
  processingTime: number,
  errorCode: VideoImportErrorCode
): string[] {
  const performanceGuidance: string[] = []
  
  // If processing took a long time before failing
  if (processingTime > 30000) { // > 30 seconds
    performanceGuidance.push('Processing took a while - consider using shorter videos for faster results')
  }
  
  // If it failed quickly, might be an immediate issue
  if (processingTime < 5000) { // < 5 seconds
    if (errorCode === VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED) {
      performanceGuidance.push('Failed quickly - likely a URL or access issue')
    }
  }
  
  return [...performanceGuidance, ...baseSuggestions]
}

/**
 * Convert error to user-friendly HTML for display
 */
export function errorToHtml(error: UserFriendlyError): string {
  const severityColors = {
    low: 'text-yellow-600 bg-yellow-50',
    medium: 'text-orange-600 bg-orange-50', 
    high: 'text-red-600 bg-red-50'
  }
  
  const severityIcons = {
    low: '⚠️',
    medium: '🚨',
    high: '❗'
  }
  
  return `
    <div class="rounded-lg border ${severityColors[error.severity]} p-4 mb-4">
      <div class="flex items-center mb-2">
        <span class="text-xl mr-2">${severityIcons[error.severity]}</span>
        <h3 class="text-lg font-semibold">${error.title}</h3>
      </div>
      
      <p class="mb-4 text-gray-700">${error.message}</p>
      
      <div class="mb-4">
        <h4 class="font-medium mb-2">💡 Here's how to fix it:</h4>
        <ul class="list-disc list-inside space-y-1">
          ${error.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
      </div>
      
      <div class="flex items-center justify-between text-sm text-gray-600">
        <span>⏱️ Estimated fix time: ${error.estimatedFixTime}</span>
        ${error.canRetry ? '<span class="text-green-600">✅ You can try again</span>' : '<span class="text-red-600">❌ Need different video</span>'}
      </div>
      
      ${error.helpfulLinks && error.helpfulLinks.length > 0 ? `
        <div class="mt-3 pt-3 border-t border-gray-200">
          <p class="text-sm text-gray-600 mb-2">📚 Helpful resources:</p>
          ${error.helpfulLinks.map(link => `<a href="${link.url}" class="text-blue-600 hover:underline mr-4">${link.text}</a>`).join('')}
        </div>
      ` : ''}
    </div>
  `
}

/**
 * Get quick suggestions for common error patterns
 */
export function getQuickSuggestions(errorPattern: string): string[] {
  const patterns: Record<string, string[]> = {
    'network': [
      'Check your internet connection',
      'Try again in a few minutes',
      'Use a different network if possible'
    ],
    'timeout': [
      'Use a shorter video (under 3 minutes)',
      'Try during off-peak hours',
      'Check your connection speed'
    ],
    'audio': [
      'Make sure the video has clear speech',
      'Avoid videos with loud background music',
      'Use videos with cooking narration'
    ],
    'private': [
      'Make sure the video is public',
      'Check if you can view it without logging in',
      'Try a different video'
    ],
    'format': [
      'Use Instagram Reels, TikTok, or YouTube Shorts',
      'Check the video URL format',
      'Copy the URL from the platform directly'
    ]
  }
  
  const lowerPattern = errorPattern.toLowerCase()
  
  for (const [pattern, suggestions] of Object.entries(patterns)) {
    if (lowerPattern.includes(pattern)) {
      return suggestions
    }
  }
  
  return [
    'Try again with the same video',
    'Use a different video',
    'Check our troubleshooting guide'
  ]
}

/**
 * Generate contextual help text based on user history
 */
export function generateContextualHelp(
  errorHistory: VideoImportErrorCode[],
  successCount: number
): string {
  if (successCount === 0 && errorHistory.length > 2) {
    return "It looks like you're having trouble getting started. Consider checking our video format guide or trying one of our example videos that are known to work well."
  }
  
  if (errorHistory.filter(e => e === VideoImportErrorCode.TRANSCRIPTION_FAILED).length > 2) {
    return "We notice you're having repeated transcription issues. Try looking for videos with very clear speech and minimal background noise for the best results."
  }
  
  if (errorHistory.filter(e => e === VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED).length > 2) {
    return "Multiple download failures suggest checking video privacy settings. Make sure the videos you're trying to import are publicly accessible."
  }
  
  if (successCount > 5) {
    return "You're doing great! You've successfully imported several recipes. Feel free to explore more advanced features or try importing from different platforms."
  }
  
  return "If you continue having issues, our support team is here to help. Check the help section for more detailed troubleshooting steps."
} 