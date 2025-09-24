import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { withTempSession } from '@/lib/temp-file-manager'
import { validateVideoUrl, getPlatformDisplayName } from '@/lib/video-url-validator'
import { getRecipeTagSuggestions } from '@/lib/ai-client'
import fetch from 'node-fetch'

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
You are an expert recipe extraction AI. Extract a recipe from this video transcription.

TRANSCRIPTION (in French):
${transcription}

IMPORTANT: Since the transcription is in French, respond entirely in French.

Extract and structure this into a recipe with this JSON format:

{
  "title": "Nom de la recette en français",
  "rawIngredients": ["ingrédient 1", "ingrédient 2", "..."],
  "instructions": [
    {
      "text": "Description de l'étape en français",
      "order": 1
    },
    {
      "text": "Description de l'étape suivante en français", 
      "order": 2
    }
  ],
  "language": "fr",
  "confidence": "high/medium/low"
}

RULES:
1. Title, ingredients, and instructions must be in French
2. Extract all mentioned ingredients 
3. Create clear step-by-step instructions
4. Return only valid JSON

${metadata ? `Metadata: ${JSON.stringify(metadata, null, 2)}` : ''}`

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
  if (message.includes('transcription failed') || message.includes('whisper') || message.includes('openai api error')) {
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
 * Transcribe audio using local Whisper
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  console.log(`🎵 Starting transcription for audio file: ${audioPath}`)
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not configured')
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.')
  }
  console.log('✅ OpenAI API key is configured')

  try {
    // Check if file exists
    console.log('📁 Checking if audio file exists...')
    const fileExists = await fs.access(audioPath).then(() => true).catch(() => false)
    if (!fileExists) {
      console.error('❌ Audio file does not exist:', audioPath)
      throw new Error(`Audio file does not exist: ${audioPath}`)
    }
    console.log('✅ Audio file exists')

    // Read the audio file
    console.log('📖 Reading audio file...')
    const audioBuffer = await fs.readFile(audioPath)
    console.log(`📁 Audio file size: ${audioBuffer.length} bytes`)
    console.log(`📁 Audio file path: ${audioPath}`)
    
    // Check if file exists and has content
    if (audioBuffer.length === 0) {
      console.error('❌ Audio file is empty')
      throw new Error('Audio file is empty')
    }
    
    // Check file size limit (OpenAI has a 25MB limit)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (audioBuffer.length > maxSize) {
      console.log(`⚠️  Audio file is too large: ${audioBuffer.length} bytes (max: ${maxSize} bytes)`)
      throw new Error(`Audio file too large: ${audioBuffer.length} bytes (max: ${maxSize} bytes)`)
    }
    
    console.log('🔄 Audio file is valid for OpenAI API')
    
    // Call OpenAI Whisper API
    console.log('🤖 Calling OpenAI Whisper API...')
    
    // Use axios for better multipart form data handling
    const axios = (await import('axios')).default
    const FormData = (await import('form-data')).default
    
    console.log('📦 Creating FormData...')
    const formData = new FormData()
    formData.append('file', audioBuffer, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    })
    formData.append('model', 'whisper-1')
    // Remove language parameter - let Whisper auto-detect
    formData.append('response_format', 'text')
    
    console.log('🔑 API Key check:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing')
    console.log('📁 FormData created with audio buffer size:', audioBuffer.length, 'bytes')
    console.log('📋 FormData headers:', formData.getHeaders())
    
    let response: any
    try {
      console.log('📤 Sending axios request to OpenAI...')
      response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      })
      console.log('✅ Axios request successful, status:', response.status)
    } catch (axiosError: any) {
      console.error('❌ Axios request failed:')
      console.error('  - Status:', axiosError.response?.status)
      console.error('  - Status Text:', axiosError.response?.statusText)
      console.error('  - Response Data:', axiosError.response?.data)
      console.error('  - Error Message:', axiosError.message)
      console.error('  - Request Config:', {
        url: axiosError.config?.url,
        method: axiosError.config?.method,
        headers: axiosError.config?.headers
      })
      throw axiosError
    }

    if (response.status !== 200) {
      console.error('❌ OpenAI API error:', response.status, response.data)
      console.error('📄 Full error response:', JSON.stringify(response.data, null, 2))
      console.error('📁 Audio file details:')
      console.error('  - Path:', audioPath)
      console.error('  - Size:', audioBuffer.length, 'bytes')
      console.error('  - Size in MB:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB')
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(response.data)}`)
    }

    const transcription = response.data
    console.log(`📝 Transcription successful, text length: ${transcription.length}`)
    console.log(`📄 Transcription preview: ${transcription.substring(0, 200)}...`)
    
    return transcription
  } catch (error) {
    console.error('❌ Transcription failed:', error)
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Structure recipe using Anthropic Claude API
 */
async function structureRecipe(transcription: string, metadata?: { title?: string; ingredients?: string[] }): Promise<any> {
  console.log('🧠 Starting recipe structuring with Anthropic Claude...')
  console.log(`📝 Transcription length: ${transcription.length}`)
  console.log(`📊 Metadata:`, metadata)
  
  // Check if Anthropic API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.')
  }

  try {
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    
    const prompt = getRecipeStructuringPrompt(transcription, metadata)
    console.log('📋 Recipe structuring prompt (first 500 chars):', prompt.substring(0, 500))
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })

    const rawResponse = response.content[0]
    if (rawResponse.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic')
    }
    
    const content = rawResponse.text
    console.log('🤖 Claude raw response (first 500 chars):', content.substring(0, 500))

    // Extract JSON from Claude response with robust parsing
    let jsonContent = content
    
    // Try to find JSON in code blocks first
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim()
      console.log('✅ Found JSON in code block')
    } else {
      // Try to find JSON in the response body with better parsing
      const jsonStart = content.indexOf('{')
      if (jsonStart !== -1) {
        // Find the matching closing brace by counting braces
        let braceCount = 0
        let jsonEnd = jsonStart
        for (let i = jsonStart; i < content.length; i++) {
          if (content[i] === '{') braceCount++
          if (content[i] === '}') braceCount--
          if (braceCount === 0) {
            jsonEnd = i
            break
          }
        }
        
        if (braceCount === 0) {
          jsonContent = content.substring(jsonStart, jsonEnd + 1).trim()
          console.log('✅ Found JSON in response body')
        } else {
          console.log('❌ No valid JSON found in response')
          throw new Error('No valid JSON found in Claude response')
        }
      } else {
        console.log('❌ No JSON found in response')
        throw new Error('No valid JSON found in Claude response')
      }
    }
    
    // Additional cleanup: try to find the first complete JSON object
    // This handles cases where there might be multiple JSON objects or text after
    try {
      // Try to parse the current content first
      JSON.parse(jsonContent)
      console.log('✅ JSON is already valid')
    } catch (firstError) {
      console.log('⚠️ JSON needs cleaning, attempting to fix...')
      
      // Try to find the first complete JSON object by looking for the first valid JSON
      const lines = jsonContent.split('\n')
      let validJson = ''
      let foundValidJson = false
      
      for (let i = 0; i < lines.length; i++) {
        const testJson = lines.slice(0, i + 1).join('\n')
        try {
          JSON.parse(testJson)
          validJson = testJson
          foundValidJson = true
          break
        } catch (e) {
          // Continue trying
        }
      }
      
      if (foundValidJson) {
        console.log('✅ Found valid JSON by line-by-line parsing')
        jsonContent = validJson
      } else {
        // Last resort: try to find JSON between the first { and last }
        const firstBrace = jsonContent.indexOf('{')
        const lastBrace = jsonContent.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const candidateJson = jsonContent.substring(firstBrace, lastBrace + 1)
          try {
            JSON.parse(candidateJson)
            console.log('✅ Found valid JSON using first/last brace method')
            jsonContent = candidateJson
          } catch (e) {
            console.log('❌ All JSON extraction methods failed')
            throw new Error('Could not extract valid JSON from response')
          }
        }
      }
    }
    
    console.log('📋 Extracted JSON content:', jsonContent)
    console.log('📋 JSON content length:', jsonContent.length)
    console.log('📋 JSON content ends with:', jsonContent.slice(-50))
    
    try {
      const parsed = JSON.parse(jsonContent)
      console.log('✅ Successfully parsed recipe structure:', parsed)
      return parsed
    } catch (parseError) {
      console.error('❌ JSON parsing failed in import-video route:', parseError)
      console.error('❌ Full JSON content length:', jsonContent.length)
      console.error('❌ Full JSON content:', jsonContent)
      console.error('❌ JSON content at position 145:', jsonContent.substring(140, 150))
      console.error('❌ Character at position 145:', jsonContent.charAt(145))
      console.error('❌ Characters around position 145:', jsonContent.substring(140, 155))
      
      // Try to find where the JSON actually ends
      const firstBrace = jsonContent.indexOf('{')
      const lastBrace = jsonContent.lastIndexOf('}')
      console.error('❌ First brace at:', firstBrace, 'Last brace at:', lastBrace)
      console.error('❌ Content between braces:', jsonContent.substring(firstBrace, lastBrace + 1))
      
      throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Recipe structuring failed:', error)
    throw new Error(`Recipe structuring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract basic metadata from video page (placeholder - will be implemented in Task 3.2)
 */
async function extractVideoMetadata(videoUrl: string): Promise<{ title?: string; ingredients?: string[] }> {
  // TODO: Implement HTML parsing in Task 3.2
  return {}
}

// Helper: Extract default thumbnail URL for supported platforms
async function getDefaultThumbnailUrl(videoUrl: string, platform: string): Promise<string | null> {
  if (platform === 'youtube') {
    // Extract video ID from URL
    const match = videoUrl.match(/[?&]v=([\w-]+)/) || videoUrl.match(/youtu\.be\/([\w-]+)/) || videoUrl.match(/shorts\/([\w-]+)/)
    const videoId = match ? match[1] : null
    if (videoId) {
      // Standard YouTube thumbnail URL
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    }
  } else if (platform === 'tiktok') {
    // TikTok: Try multiple approaches with different user agents
    console.log('🔍 TikTok: Attempting to fetch thumbnail from:', videoUrl)
    
    const tiktokApproaches: Array<{ headers: Record<string, string>; name: string }> = [
      // Approach 1: Mobile Safari (iOS)
      {
        name: 'Mobile Safari',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      },
      // Approach 2: Android Chrome
      {
        name: 'Android Chrome',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      },
      // Approach 3: Facebook crawler
      {
        name: 'Facebook Crawler',
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      // Approach 4: Twitter crawler
      {
        name: 'Twitter Crawler',
        headers: {
          'User-Agent': 'Twitterbot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    ]

    for (const approach of tiktokApproaches) {
      try {
        console.log(`🔍 TikTok: Trying ${approach.name} approach...`)
        const res = await fetch(videoUrl, { headers: approach.headers })
        console.log(`🔍 TikTok ${approach.name} response:`, res.status, res.statusText)
        
                 if (res.ok) {
          const html = await res.text()
          console.log(`🔍 TikTok ${approach.name} HTML length:`, html.length)
          
          // Strategy 1: Look for clean video cover/poster images first
          const cleanImagePatterns = [
            // Video poster/cover images (usually clean without play button)
            /"poster":\s*"([^"]+)"/,
            /"cover":\s*"([^"]+)"/,
            /"videoUrl":\s*"([^"]+)".*?"poster":\s*"([^"]+)"/,
            // Dynamic video thumbnails in JSON-LD or script tags
            /"dynamicCover":\s*"([^"]+)"/,
            /"originCover":\s*"([^"]+)"/,
            // Alternative image sources
            /"video":\s*{[^}]*"cover":\s*"([^"]+)"/,
            /"itemStruct":\s*{[^}]*"video":\s*{[^}]*"cover":\s*"([^"]+)"/
          ]
          
                     for (const pattern of cleanImagePatterns) {
             const match = html.match(pattern)
             if (match) {
               // Get the last capture group (the actual URL)
               let imageUrl = match[match.length - 1]
               if (imageUrl) {
                 // Unescape Unicode characters (e.g., \u002F -> /)
                 imageUrl = imageUrl.replace(/\\u002F/g, '/')
                 imageUrl = imageUrl.replace(/\\u003A/g, ':')
                 imageUrl = imageUrl.replace(/\\u003D/g, '=')
                 imageUrl = imageUrl.replace(/\\u0026/g, '&')
                 imageUrl = imageUrl.replace(/\\u003F/g, '?')
                 
                 if (imageUrl.startsWith('http')) {
                   console.log(`✅ TikTok clean thumbnail found via pattern (${approach.name}):`, imageUrl)
                   return imageUrl
                 }
               }
             }
           }
          
                     // Strategy 2: Try og:image but filter out ones with play button indicators
           const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
           if (ogMatch) {
             let ogImageUrl = ogMatch[1]
             // Unescape Unicode characters
             ogImageUrl = ogImageUrl.replace(/\\u002F/g, '/')
             ogImageUrl = ogImageUrl.replace(/\\u003A/g, ':')
             ogImageUrl = ogImageUrl.replace(/\\u003D/g, '=')
             ogImageUrl = ogImageUrl.replace(/\\u0026/g, '&')
             ogImageUrl = ogImageUrl.replace(/\\u003F/g, '?')
             
             // Skip if URL suggests it's a play button overlay image
             if (!ogImageUrl.includes('play') && !ogImageUrl.includes('overlay') && !ogImageUrl.includes('thumb-play')) {
               console.log(`✅ TikTok thumbnail found via og:image (${approach.name}):`, ogImageUrl)
               return ogImageUrl
             } else {
               console.log(`⚠️ TikTok og:image appears to have play button overlay, skipping:`, ogImageUrl)
             }
           }
           
           // Strategy 3: Try twitter:image as fallback
           const twitterMatch = html.match(/<meta name="twitter:image" content="([^"]+)"/)
           if (twitterMatch) {
             let twitterImageUrl = twitterMatch[1]
             // Unescape Unicode characters
             twitterImageUrl = twitterImageUrl.replace(/\\u002F/g, '/')
             twitterImageUrl = twitterImageUrl.replace(/\\u003A/g, ':')
             twitterImageUrl = twitterImageUrl.replace(/\\u003D/g, '=')
             twitterImageUrl = twitterImageUrl.replace(/\\u0026/g, '&')
             twitterImageUrl = twitterImageUrl.replace(/\\u003F/g, '?')
             
             console.log(`✅ TikTok thumbnail found via twitter:image (${approach.name}):`, twitterImageUrl)
             return twitterImageUrl
           }
          
          console.log(`❌ TikTok ${approach.name}: No clean image sources found`)
        } else {
          console.log(`❌ TikTok ${approach.name} fetch failed:`, res.status, res.statusText)
        }
      } catch (err) { 
        console.log(`❌ TikTok ${approach.name} error:`, err)
      }
    }
      } else if (platform === 'instagram') {
    // Instagram: Advanced multi-strategy approach
    console.log('🔍 Instagram: Attempting advanced thumbnail extraction from:', videoUrl)
    
        // Note: Instagram has become very restrictive with external access
    // We'll focus on basic page scraping and accept that thumbnails may have play button overlays
    console.log('ℹ️ Instagram restricts external access - attempting basic scraping only')
    
    // Strategy 1: Enhanced traditional scraping with more user agents
    const approaches: Array<{ headers: Record<string, string>; name: string }> = [
      // Approach 1: Instagram mobile app user agent
      {
        name: 'Instagram Mobile App',
        headers: {
          'User-Agent': 'Instagram 219.0.0.12.117 Android',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      },
      // Approach 2: WhatsApp user agent (Meta-owned)
      {
        name: 'WhatsApp',
        headers: {
          'User-Agent': 'WhatsApp/2.21.4.18 A',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      // Approach 3: Old iOS Safari
      {
        name: 'Old iOS Safari',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      },
      // Approach 4: LinkedIn crawler
      {
        name: 'LinkedIn',
        headers: {
          'User-Agent': 'LinkedInBot/1.0 (compatible; Mozilla/5.0; +https://www.linkedin.com/)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      // Approach 5: Pinterest crawler
      {
        name: 'Pinterest',
        headers: {
          'User-Agent': 'Pinterest/0.2 (+https://www.pinterest.com/)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    ]

    for (const approach of approaches) {
      try {
        console.log(`🔍 Instagram: Trying ${approach.name} approach...`)
        const res = await fetch(videoUrl, { headers: approach.headers })
        console.log(`🔍 Instagram ${approach.name} response:`, res.status, res.statusText)
        
        if (res.ok) {
          const html = await res.text()
          console.log(`🔍 Instagram ${approach.name} HTML length:`, html.length)
          
          // Try multiple patterns (prioritize clean images)
          const patterns = [
            // Strategy 1: Look for specific 360x640 resolution (actual Instagram size)
            /"src":"([^"]+)"[^}]*"config_width":360[^}]*"config_height":640/,
            /"src":"([^"]+)"[^}]*"config_width":360/,
            /"src":"([^"]+)"[^}]*"config_height":640/,
            // Strategy 2: Look for clean video-specific images
            /"video_url":"[^"]*".*?"display_url":"([^"]+)"/,
            /"poster":"([^"]+)"/,
            /"cover_frame_url":"([^"]+)"/,
            /"video_versions":\[[^\]]*\].*?"image_versions2":\{[^}]*"candidates":\[[^\]]*\{[^}]*"url":"([^"]+)"/,
            // Strategy 3: High-quality display images
            /"display_url":"([^"]+)"/,
            /"thumbnail_src":"([^"]+)"/,
            // Strategy 4: Filter og:image and twitter:image for play button indicators
            /<meta property="og:image" content="([^"]+)"/,
            /<meta name="twitter:image" content="([^"]+)"/
          ]
          
                    for (const pattern of patterns) {
            const match = html.match(pattern)
            if (match) {
              let thumbnailUrl = match[1]
              // Unescape Unicode characters
              thumbnailUrl = thumbnailUrl.replace(/\\u002F/g, '/').replace(/\\u003A/g, ':').replace(/\\u003D/g, '=').replace(/\\u0026/g, '&')
              // Decode HTML entities
              thumbnailUrl = thumbnailUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
              
              if (thumbnailUrl.startsWith('http')) {
                // Check if this is likely a clean image (for og:image and twitter:image)
                const isMetaTag = pattern.source.includes('og:image') || pattern.source.includes('twitter:image')
                if (isMetaTag) {
                  // Skip if URL suggests it has play button overlay
                  if (thumbnailUrl.includes('play') || thumbnailUrl.includes('overlay') || 
                      thumbnailUrl.includes('thumb-play') || thumbnailUrl.includes('video-thumb')) {
                    console.log(`⚠️ Instagram ${approach.name}: Skipping image with play button overlay:`, thumbnailUrl)
                    continue
                  }
                }
                
                console.log(`✅ Instagram thumbnail found via ${approach.name}:`, thumbnailUrl)
                return thumbnailUrl
              }
            }
          }
        }
      } catch (err) {
        console.log(`❌ Instagram ${approach.name} error:`, err)
      }
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json() // Only call this ONCE
  const { url, recipeId, extractThumbnail } = body

  // Instagram thumbnail extraction branch
  if (extractThumbnail && url && recipeId && url.includes('instagram.com')) {
    // 1. Fetch the Instagram page
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch Instagram page' }), { status: 400 })
    }
    const html = await res.text()
    // 2. Parse og:image meta tag
    const match = html.match(/<meta property="og:image" content="([^"]+)"/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not find thumbnail in Instagram page' }), { status: 400 })
    }
    const imageUrl = match[1]
    // 3. Download the image
    const imageRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0; +https://yourdomain.com)',
        'Referer': url
      }
    })
    if (!imageRes.ok) {
      // Return the thumbnail URL so the frontend can use it for manual upload
      return new Response(JSON.stringify({ error: 'Failed to download thumbnail image', thumbnailUrl: imageUrl }), { status: 400 })
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer())
    // 4. Save to uploads dir
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
    const filename = `recipe-${recipeId}-instagram-thumb-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recipes')
    await fs.mkdir(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, filename)
    await fs.writeFile(filePath, buffer)
    const publicUrl = `/uploads/recipes/${filename}`
    // 5. Update recipe
    const recipe = await prisma.recipe.update({
      where: { id: Number(recipeId) },
      data: { image: publicUrl }
    })
    return new Response(JSON.stringify(recipe), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
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

    // Get processing timeout from environment or default to 180 seconds (3 minutes)
    const processingTimeout = parseInt(process.env.VIDEO_PROCESSING_TIMEOUT || '180000')

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
            console.log(`🎬 Starting video analysis for URL: ${validatedUrl}`)
            console.log(`📱 Platform detected: ${platform}`)
            sendJSON(createProgressResponse('analyzing', platform ? getPlatformDisplayName(platform) : undefined))
            
            // Extract video metadata with timeout
            console.log('🔍 Extracting video metadata...')
            const metadata = await withTimeout(
              extractVideoMetadata(validatedUrl),
              10000,
              'Metadata extraction timed out'
            )
            console.log('📊 Video metadata extracted:', metadata)
            endStage('analyzing', true)
            
            // Process video with temporary session
            await withTempSession(async (paths) => {
              try {
                // Stage 2: Downloading with timeout
                startStage('downloading')
                console.log('⬇️  Starting video download and audio extraction...')
                sendJSON(createProgressResponse('downloading'))
                
                // Extract audio from video with timeout
                await withTimeout(
                  new Promise<void>((resolve, reject) => {
                    const args = [
                      validatedUrl,
                      '--extract-audio',
                      '--audio-format', 'mp3',
                      '--audio-quality', '5',
                      '--output', paths.audioPath.replace('.mp3', '.%(ext)s'),
                      '--no-playlist',
                      '--no-warnings',
                      '--user-agent', 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
                      '--postprocessor-args', 'ffmpeg:-ar 16000 -ac 1'
                    ]

                    console.log('🔧 Running yt-dlp with args:', args)
                    const child = spawn('yt-dlp', args)
                    
                    child.on('close', (code) => {
                      console.log(`📥 yt-dlp process completed with code: ${code}`)
                      if (code !== 0) {
                        reject(new Error('Video download failed'))
                      } else {
                        console.log('✅ Video download and audio extraction successful')
                        resolve()
                      }
                    })

                    child.on('error', (err) => {
                      reject(new Error('Video processing tool not available'))
                    })
                  }),
                  30000,
                  'Video download and audio extraction timed out'
                )
                endStage('downloading', true)
                
                // Stage 3: Transcribing with timeout
                startStage('transcribing')
                console.log('🎤 Starting audio transcription...')
                sendJSON(createProgressResponse('transcribing'))
                
                // Transcribe audio to text with timeout
                const transcription = await withTimeout(
                  transcribeAudio(paths.audioPath),
                  20000,
                  'Audio transcription timed out'
                )
                
                console.log('📝 Transcription result (first 500 chars):', transcription.substring(0, 500))
                console.log('📏 Transcription length:', transcription.length)
                
                if (!transcription.trim()) {
                  console.log('❌ No speech detected in video')
                  endStage('transcribing', false, 'No speech detected')
                  throw new Error('No speech detected in video')
                }

                // Save transcription for debugging
                await fs.writeFile(paths.transcriptPath, transcription)
                endStage('transcribing', true)
                
                // Stage 4: Structuring with timeout
                startStage('structuring')
                console.log('🧠 Starting recipe structuring with AI...')
                sendJSON(createProgressResponse('structuring'))
                
                // Structure recipe using AI with timeout
                const structuredData = await withTimeout(
                  structureRecipe(transcription, metadata),
                  60000,
                  'Recipe structuring timed out'
                )
                
                console.log('📋 Structured recipe data:', JSON.stringify(structuredData, null, 2))
                endStage('structuring', true)

                // Get LLM tag suggestions
                let suggestedTags: string[] = []
                let suggestedTagsRaw: string = ''
                try {
                  console.log('🏷️  Getting tag suggestions...')
                  const tagResults = await getRecipeTagSuggestions({
                    title: structuredData.title || '',
                    ingredients: structuredData.rawIngredients || [],
                    instructions: Array.isArray(structuredData.instructions)
                      ? structuredData.instructions.map((step: any) => step.text || '').join(' ')
                      : (structuredData.instructions || '')
                  })
                  suggestedTags = tagResults.tags || []
                  suggestedTagsRaw = tagResults.raw || ''
                  console.log('🏷️  Tag suggestions:', suggestedTags)
                  console.log('📄 Raw tag response:', suggestedTagsRaw)
                } catch (err) {
                  console.log('⚠️  Tag suggestion failed:', err)
                  // If tag suggestion fails, continue without blocking import
                  suggestedTags = []
                  suggestedTagsRaw = ''
                }

                // Prepare final response data
                const extractedData: ExtractedRecipeData = {
                  title: structuredData.title,
                  rawIngredients: structuredData.rawIngredients || [],
                  instructions: Array.isArray(structuredData.instructions) 
                    ? structuredData.instructions.map((step: any) => `${step.order || ''}. ${step.text || ''}`).join('\n')
                    : (structuredData.instructions || ''),
                  sourceUrl: validatedUrl,
                  transcription,
                  metadata: {
                    platform: platform as 'instagram' | 'tiktok' | 'youtube',
                    videoId: undefined, // TODO: Extract from validator
                    extractedAt: new Date().toISOString()
                  },
                  suggestedTags,
                  suggestedTagsRaw
                }

                // Calculate processing time
                stats.endTime = Date.now()
                stats.duration = stats.endTime - stats.startTime
                console.log(`⏱️  Total processing time: ${stats.duration}ms`)
                console.log('📊 Processing statistics:', stats)
                
                // --- Task 3.2: Fetch default platform thumbnail for review dialog ---
                let thumbnailCandidateUrl: string | null = null
                console.log('🔍 About to call getDefaultThumbnailUrl with:', { validatedUrl, platform })
                const thumbnailUrl = await getDefaultThumbnailUrl(validatedUrl, platform!)
                console.log('📸 getDefaultThumbnailUrl returned:', thumbnailUrl)
                console.log('Attempting to fetch thumbnailUrl:', thumbnailUrl)
                if (thumbnailUrl) {
                  // For review dialog, we just need the URL - don't need to download it yet
                  thumbnailCandidateUrl = thumbnailUrl
                  console.log('✅ Thumbnail URL ready for review dialog:', thumbnailCandidateUrl)
                  
                  // Optional: Test if we can fetch it (for logging purposes)
                  try {
                    const imgRes = await fetch(thumbnailUrl)
                    if (!imgRes.ok) {
                      console.log('ℹ️ Note: Thumbnail URL found but cannot be fetched directly (CORS):', imgRes.status, imgRes.statusText)
                    } else {
                      console.log('✅ Thumbnail URL is directly fetchable')
                    }
                  } catch (err) {
                    console.log('ℹ️ Note: Thumbnail URL found but cannot be fetched directly (CORS):', err)
                  }
                }
                
                // Add candidateImages if thumbnailCandidateUrl exists
                console.log('🔍 Debug: thumbnailCandidateUrl =', thumbnailCandidateUrl)
                if (thumbnailCandidateUrl) {
                  console.log('Adding candidateImages:', thumbnailCandidateUrl)
                  extractedData.candidateImages = [thumbnailCandidateUrl]
                  console.log('✅ extractedData.candidateImages set to:', extractedData.candidateImages)
                } else {
                  console.log('❌ No thumbnailCandidateUrl, candidateImages will be undefined')
                }
                
                console.log('Final extractedData before sendJSON:', extractedData)
                console.log('Final extractedData.candidateImages:', extractedData.candidateImages)
                
                // Send response for user review - no database save yet
                const warnings: string[] = []
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