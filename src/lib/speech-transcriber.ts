/**
 * Speech Transcriber
 * Handles speech-to-text transcription using Ollama's Whisper model
 */

import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { VideoImportErrorCode } from '@/types/video-import'

export interface TranscriptionOptions {
  model?: string
  language?: string
  temperature?: number
  timeout?: number
  chunkSize?: number
  maxRetries?: number
}

export interface TranscriptionResult {
  success: boolean
  text?: string
  confidence?: number
  language?: string
  duration?: number
  segments?: TranscriptionSegment[]
  error?: string
  errorCode?: VideoImportErrorCode
  warnings?: string[]
  processingTime?: number
  retryable?: boolean
  suggestions?: string[]
  retryCount?: number
  partialTranscription?: string
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  confidence?: number
}

export interface TranscriptionProgress {
  stage: 'initializing' | 'loading' | 'processing' | 'finalizing' | 'completed' | 'failed'
  progress?: number
  message?: string
  currentSegment?: number
  totalSegments?: number
}

/**
 * Default configuration for speech transcription
 */
const DEFAULT_CONFIG = {
  model: 'dimavz/whisper-tiny',
  language: 'auto', // Auto-detect language
  temperature: 0.0, // More deterministic results
  timeout: 180000, // 3 minutes timeout
  chunkSize: 30, // 30 second chunks for long audio
  maxRetries: 3,
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434'
}

/**
 * Transcribe audio file using Ollama's Whisper model with comprehensive error handling and retry logic
 */
export async function transcribeAudio(
  audioPath: string,
  options: TranscriptionOptions = {},
  onProgress?: (progress: TranscriptionProgress) => void
): Promise<TranscriptionResult> {
  const config = { ...DEFAULT_CONFIG, ...options }
  const warnings: string[] = []
  const startTime = Date.now()

  try {
    onProgress?.({ stage: 'initializing', message: 'Preparing audio for transcription...' })

    // Step 1: Validate audio file exists and is readable
    const audioValidation = await validateAudioFile(audioPath)
    if (!audioValidation.isValid) {
      const errorCode = categorizeTranscriptionError(audioValidation.error || '')
      return createTranscriptionErrorResult(
        audioValidation.error || 'Invalid audio file',
        errorCode,
        warnings,
        startTime
      )
    }

    // Step 2: Check if Ollama is available and model is ready
    onProgress?.({ stage: 'loading', message: 'Checking Ollama service and model...', progress: 10 })
    
    const modelCheck = await checkOllamaModel(config.model)
    if (!modelCheck.available) {
      const errorCode = categorizeTranscriptionError(modelCheck.error || '')
      return createTranscriptionErrorResult(
        modelCheck.error || 'Ollama model not available',
        errorCode,
        warnings,
        startTime
      )
    }

    // Step 3: Determine if we need to chunk the audio and transcribe with retry logic
    const audioInfo = audioValidation.info!
    const needsChunking = audioInfo.duration && audioInfo.duration > config.chunkSize

    if (needsChunking) {
      onProgress?.({ stage: 'processing', message: 'Processing audio in chunks...', progress: 20 })
      return await transcribeInChunksWithRetry(audioPath, audioInfo, config, onProgress, warnings, startTime)
    } else {
      onProgress?.({ stage: 'processing', message: 'Transcribing audio...', progress: 20 })
      return await transcribeSingleWithRetry(audioPath, audioInfo, config, onProgress, warnings, startTime)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = categorizeTranscriptionError(errorMessage)
    
    onProgress?.({ stage: 'failed', message: `Transcription failed: ${errorMessage}` })

    return createTranscriptionErrorResult(
      `Transcription failed: ${errorMessage}`,
      errorCode,
      warnings,
      startTime
    )
  }
}

/**
 * Validate audio file for transcription
 */
async function validateAudioFile(audioPath: string): Promise<{
  isValid: boolean
  error?: string
  info?: { duration?: number; size?: number; format?: string }
}> {
  try {
    // Check if file exists
    const stats = await fs.stat(audioPath)
    
    if (stats.size === 0) {
      return { isValid: false, error: 'Audio file is empty' }
    }

    if (stats.size > 100 * 1024 * 1024) { // 100MB limit
      return { isValid: false, error: 'Audio file is too large (max 100MB)' }
    }

    // Get audio information using ffprobe
    const audioInfo = await getAudioInfo(audioPath)
    
    if (!audioInfo.duration || audioInfo.duration < 0.5) {
      return { isValid: false, error: 'Audio is too short (minimum 0.5 seconds)' }
    }

    if (audioInfo.duration > 1800) { // 30 minutes
      return { isValid: false, error: 'Audio is too long (maximum 30 minutes)' }
    }

    return {
      isValid: true,
      info: {
        duration: audioInfo.duration,
        size: stats.size,
        format: audioInfo.format
      }
    }

  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Get audio file information using ffprobe
 */
async function getAudioInfo(audioPath: string): Promise<{
  duration?: number
  format?: string
  sampleRate?: number
  channels?: number
}> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      audioPath
    ])

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
        reject(new Error(`ffprobe failed: ${errorOutput}`))
        return
      }

      try {
        const info = JSON.parse(output)
        const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio')
        
        resolve({
          duration: parseFloat(info.format?.duration) || undefined,
          format: audioStream?.codec_name,
          sampleRate: parseInt(audioStream?.sample_rate) || undefined,
          channels: parseInt(audioStream?.channels) || undefined
        })
      } catch (parseError) {
        reject(new Error(`Failed to parse ffprobe output: ${parseError}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Check if Ollama model is available
 */
async function checkOllamaModel(modelName: string): Promise<{
  available: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${DEFAULT_CONFIG.ollamaHost}/api/tags`)
    
    if (!response.ok) {
      return {
        available: false,
        error: `Ollama service not available: ${response.status}`
      }
    }

    const data = await response.json()
    const models = data.models || []
    
    const modelExists = models.some((model: any) => 
      model.name === modelName || 
      model.name.startsWith(modelName.split(':')[0])
    )

    if (!modelExists) {
      return {
        available: false,
        error: `Model ${modelName} not found. Available models: ${models.map((m: any) => m.name).join(', ')}`
      }
    }

    return { available: true }

  } catch (error) {
    return {
      available: false,
      error: `Failed to check Ollama model: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Transcribe single audio file
 */
async function transcribeSingle(
  audioPath: string,
  audioInfo: { duration?: number; size?: number; format?: string },
  config: Required<TranscriptionOptions> & typeof DEFAULT_CONFIG,
  onProgress?: (progress: TranscriptionProgress) => void,
  warnings: string[] = [],
  startTime: number = Date.now()
): Promise<TranscriptionResult> {
  try {
    // Read audio file as base64
    const audioBuffer = await fs.readFile(audioPath)
    const audioBase64 = audioBuffer.toString('base64')

    onProgress?.({ stage: 'processing', message: 'Sending to Whisper model...', progress: 50 })

    // Make request to Ollama API
    const response = await fetch(`${config.ollamaHost}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        prompt: `Transcribe this audio file. Return only the transcribed text, no additional commentary.`,
        images: [audioBase64],
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: 2000 // Limit response length
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    onProgress?.({ stage: 'finalizing', message: 'Processing transcription...', progress: 90 })

    // Extract and clean the transcribed text
    const transcribedText = cleanTranscription(result.response || '')
    
    if (!transcribedText || transcribedText.length < 2) {
      return {
        success: false,
        error: 'No transcription generated or transcription too short',
        warnings,
        processingTime: Date.now() - startTime
      }
    }

    onProgress?.({ stage: 'completed', message: 'Transcription completed successfully', progress: 100 })

    return {
      success: true,
      text: transcribedText,
      duration: audioInfo.duration,
      language: config.language === 'auto' ? 'detected' : config.language,
      confidence: estimateConfidence(transcribedText),
      warnings,
      processingTime: Date.now() - startTime
    }

  } catch (error) {
    return {
      success: false,
      error: `Single transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warnings,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Transcribe audio in chunks for longer files
 */
async function transcribeInChunks(
  audioPath: string,
  audioInfo: { duration?: number; size?: number; format?: string },
  config: Required<TranscriptionOptions> & typeof DEFAULT_CONFIG,
  onProgress?: (progress: TranscriptionProgress) => void,
  warnings: string[] = [],
  startTime: number = Date.now()
): Promise<TranscriptionResult> {
  try {
    const duration = audioInfo.duration!
    const chunkCount = Math.ceil(duration / config.chunkSize)
    const segments: TranscriptionSegment[] = []
    let fullText = ''

    onProgress?.({
      stage: 'processing',
      message: `Processing ${chunkCount} audio chunks...`,
      progress: 30,
      totalSegments: chunkCount
    })

    for (let i = 0; i < chunkCount; i++) {
      const startTime = i * config.chunkSize
      const endTime = Math.min((i + 1) * config.chunkSize, duration)
      
      onProgress?.({
        stage: 'processing',
        message: `Processing chunk ${i + 1} of ${chunkCount}...`,
        progress: 30 + ((i / chunkCount) * 50),
        currentSegment: i + 1,
        totalSegments: chunkCount
      })

      // Extract chunk using ffmpeg
      const chunkPath = `${audioPath}.chunk${i}.wav`
      
      try {
        await extractAudioChunk(audioPath, chunkPath, startTime, endTime - startTime)
        
        // Transcribe chunk
        const chunkResult = await transcribeSingle(
          chunkPath,
          { duration: endTime - startTime },
          config,
          undefined, // Don't pass progress for individual chunks
          [],
          Date.now()
        )

        // Clean up chunk file
        await fs.unlink(chunkPath).catch(() => {}) // Ignore cleanup errors

        if (chunkResult.success && chunkResult.text) {
          const segment: TranscriptionSegment = {
            start: startTime,
            end: endTime,
            text: chunkResult.text.trim(),
            confidence: chunkResult.confidence
          }
          
          segments.push(segment)
          fullText += (fullText ? ' ' : '') + segment.text
        } else {
          warnings.push(`Failed to transcribe chunk ${i + 1}: ${chunkResult.error}`)
        }

      } catch (chunkError) {
        warnings.push(`Error processing chunk ${i + 1}: ${chunkError}`)
        
        // Clean up chunk file on error
        await fs.unlink(chunkPath).catch(() => {})
      }
    }

    onProgress?.({ stage: 'finalizing', message: 'Combining transcription segments...', progress: 90 })

    if (segments.length === 0) {
      return {
        success: false,
        error: 'Failed to transcribe any audio chunks',
        warnings,
        processingTime: Date.now() - startTime
      }
    }

    // Calculate overall confidence
    const avgConfidence = segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / segments.length

    onProgress?.({ stage: 'completed', message: 'Transcription completed successfully', progress: 100 })

    return {
      success: true,
      text: fullText.trim(),
      duration: audioInfo.duration,
      language: config.language === 'auto' ? 'detected' : config.language,
      confidence: avgConfidence,
      segments,
      warnings,
      processingTime: Date.now() - startTime
    }

  } catch (error) {
    return {
      success: false,
      error: `Chunked transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warnings,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Extract audio chunk using ffmpeg
 */
async function extractAudioChunk(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  durationSeconds: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', startSeconds.toString(),
      '-t', durationSeconds.toString(),
      '-ar', '16000', // 16kHz sample rate
      '-ac', '1', // Mono
      '-f', 'wav',
      '-y', // Overwrite output
      outputPath
    ]

    const child = spawn('ffmpeg', args)
    
    let errorOutput = ''

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed: ${errorOutput}`))
      } else {
        resolve()
      }
    })

    child.on('error', reject)
  })
}

/**
 * Clean and normalize transcription text
 */
function cleanTranscription(text: string): string {
  if (!text) return ''

  return text
    // Remove common transcription artifacts
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .replace(/\(.*?\)/g, '') // Remove parenthetical content if it looks like metadata
    .replace(/^\s*transcription:?\s*/gi, '') // Remove "transcription:" prefixes
    .replace(/^\s*text:?\s*/gi, '') // Remove "text:" prefixes
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    // Basic sentence formatting
    .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => `${punct} ${letter.toUpperCase()}`)
    // Capitalize first letter
    .replace(/^[a-z]/, (match) => match.toUpperCase())
}

/**
 * Estimate transcription confidence based on text characteristics
 */
function estimateConfidence(text: string): number {
  if (!text || text.length < 2) return 0

  let confidence = 0.7 // Base confidence

  // Factors that increase confidence
  if (text.length > 50) confidence += 0.1 // Reasonable length
  if (/[.!?]/.test(text)) confidence += 0.1 // Has punctuation
  if (!/\b(um|uh|er|ah)\b/gi.test(text)) confidence += 0.05 // No filler words
  if (!/\[.*?\]/.test(text)) confidence += 0.05 // No uncertainty markers

  // Factors that decrease confidence
  if (text.length < 10) confidence -= 0.2 // Very short
  if (/\?\?\?|###|inaudible|unclear/gi.test(text)) confidence -= 0.3 // Uncertainty markers
  if ((text.match(/\s+/g) || []).length < 3) confidence -= 0.1 // Very few words

  return Math.max(0, Math.min(1, confidence))
}

/**
 * Categorize transcription errors into specific error codes
 */
function categorizeTranscriptionError(error: string): VideoImportErrorCode {
  const lowerError = error.toLowerCase()
  
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return VideoImportErrorCode.TIMEOUT
  }
  if (lowerError.includes('model not found') || lowerError.includes('not available')) {
    return VideoImportErrorCode.TRANSCRIPTION_FAILED
  }
  if (lowerError.includes('no speech') || lowerError.includes('too short')) {
    return VideoImportErrorCode.NO_SPEECH_DETECTED
  }
  if (lowerError.includes('audio') || lowerError.includes('empty') || lowerError.includes('too large')) {
    return VideoImportErrorCode.AUDIO_EXTRACTION_FAILED
  }
  if (lowerError.includes('connection') || lowerError.includes('network') || lowerError.includes('service')) {
    return VideoImportErrorCode.TRANSCRIPTION_FAILED
  }
  
  return VideoImportErrorCode.UNKNOWN_ERROR
}

/**
 * Create a standardized transcription error result
 */
function createTranscriptionErrorResult(
  error: string,
  errorCode: VideoImportErrorCode,
  warnings: string[],
  startTime: number,
  retryable: boolean = false,
  retryCount: number = 0,
  partialTranscription?: string
): TranscriptionResult {
  return {
    success: false,
    error,
    errorCode,
    warnings,
    retryable,
    suggestions: getTranscriptionSuggestions(errorCode),
    retryCount,
    processingTime: Date.now() - startTime,
    partialTranscription
  }
}

/**
 * Get user-friendly suggestions for transcription error codes
 */
function getTranscriptionSuggestions(errorCode: VideoImportErrorCode): string[] {
  const suggestions: Record<VideoImportErrorCode, string[]> = {
    [VideoImportErrorCode.INVALID_URL]: [
      'Check that the URL is complete and properly formatted',
      'Ensure the URL is from a supported platform'
    ],
    [VideoImportErrorCode.UNSUPPORTED_PLATFORM]: [
      'Only Instagram, TikTok, and YouTube Shorts are supported'
    ],
    [VideoImportErrorCode.VIDEO_DOWNLOAD_FAILED]: [
      'Check if the video is publicly accessible',
      'Verify the video still exists on the platform'
    ],
    [VideoImportErrorCode.AUDIO_EXTRACTION_FAILED]: [
      'Check if the audio file is valid',
      'Ensure the file isn\'t corrupted',
      'Try a different audio format'
    ],
    [VideoImportErrorCode.TRANSCRIPTION_FAILED]: [
      'Check if Ollama service is running',
      'Verify the Whisper model is installed',
      'Try a different audio quality or format'
    ],
    [VideoImportErrorCode.NO_SPEECH_DETECTED]: [
      'Ensure the video contains clear spoken content',
      'Check the audio volume levels',
      'Try a video with more distinct speech'
    ],
    [VideoImportErrorCode.RECIPE_STRUCTURING_FAILED]: [
      'Make sure the video is about cooking or recipes',
      'Try a video with clearer recipe instructions'
    ],
    [VideoImportErrorCode.TIMEOUT]: [
      'Try a shorter audio file',
      'Check system resources and performance',
      'Increase timeout settings if possible'
    ],
    [VideoImportErrorCode.RATE_LIMITED]: [
      'Wait a few minutes before trying again'
    ],
    [VideoImportErrorCode.PRIVATE_CONTENT]: [
      'Make sure the video is publicly accessible'
    ],
    [VideoImportErrorCode.CONTENT_UNAVAILABLE]: [
      'The video may have been deleted or made private'
    ],
    [VideoImportErrorCode.QUOTA_EXCEEDED]: [
      'Processing quota has been exceeded'
    ],
    [VideoImportErrorCode.UNKNOWN_ERROR]: [
      'Try again in a few minutes',
      'Check system resources',
      'Contact support if the problem persists'
    ]
  }
  
  return suggestions[errorCode] || suggestions[VideoImportErrorCode.UNKNOWN_ERROR] || []
}

/**
 * Check if a transcription error is retryable
 */
function isTranscriptionErrorRetryable(errorCode: VideoImportErrorCode, errorMessage: string): boolean {
  const retryableErrors = [
    VideoImportErrorCode.TIMEOUT,
    VideoImportErrorCode.TRANSCRIPTION_FAILED,
    VideoImportErrorCode.UNKNOWN_ERROR
  ]
  
  if (retryableErrors.includes(errorCode)) {
    return true
  }
  
  // Check for transient errors in message
  const lowerMessage = errorMessage.toLowerCase()
  const transientKeywords = [
    'connection', 'network', 'temporary', 'service unavailable',
    'timeout', '503', '502', '500'
  ]
  
  return transientKeywords.some(keyword => lowerMessage.includes(keyword))
}

/**
 * Transcribe single audio file with retry logic
 */
async function transcribeSingleWithRetry(
  audioPath: string,
  audioInfo: { duration?: number; size?: number; format?: string },
  config: Required<TranscriptionOptions> & typeof DEFAULT_CONFIG,
  onProgress?: (progress: TranscriptionProgress) => void,
  warnings: string[] = [],
  startTime: number = Date.now()
): Promise<TranscriptionResult> {
  let lastError = ''
  let lastErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
  let partialResult = ''

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await transcribeSingle(
        audioPath,
        audioInfo,
        config,
        onProgress,
        [],
        Date.now()
      )

      if (result.success) {
        return { ...result, retryCount: attempt - 1, warnings: warnings.concat(result.warnings || []) }
      }

      // Store error details
      lastError = result.error || 'Unknown transcription error'
      lastErrorCode = categorizeTranscriptionError(lastError)
      
      // Check if we got any partial transcription
      if (result.text && result.text.length > 0) {
        partialResult = result.text
      }

      // Check if error is retryable
      const isRetryable = isTranscriptionErrorRetryable(lastErrorCode, lastError)
      
      if (!isRetryable || attempt === config.maxRetries) {
        return createTranscriptionErrorResult(
          lastError,
          lastErrorCode,
          warnings.concat(result.warnings || []),
          startTime,
          isRetryable,
          attempt,
          partialResult || undefined
        )
      }

      // Wait before retry with exponential backoff
      const delay = 2000 * Math.pow(2, attempt - 1) // 2s, 4s, 8s, etc.
      onProgress?.({
        stage: 'processing',
        message: `Retry ${attempt}/${config.maxRetries} in ${Math.round(delay/1000)}s...`,
        progress: 20 + (attempt * 10)
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      lastErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
    }
  }

  return createTranscriptionErrorResult(
    lastError,
    lastErrorCode,
    warnings,
    startTime,
    false,
    config.maxRetries,
    partialResult || undefined
  )
}

/**
 * Transcribe audio in chunks with retry logic
 */
async function transcribeInChunksWithRetry(
  audioPath: string,
  audioInfo: { duration?: number; size?: number; format?: string },
  config: Required<TranscriptionOptions> & typeof DEFAULT_CONFIG,
  onProgress?: (progress: TranscriptionProgress) => void,
  warnings: string[] = [],
  startTime: number = Date.now()
): Promise<TranscriptionResult> {
  let lastError = ''
  let lastErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
  let bestPartialResult: TranscriptionResult | null = null

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await transcribeInChunks(
        audioPath,
        audioInfo,
        config,
        onProgress,
        [],
        Date.now()
      )

      if (result.success) {
        return { ...result, retryCount: attempt - 1, warnings: warnings.concat(result.warnings || []) }
      }

      // Keep track of the best partial result (most text)
      if (result.text && (!bestPartialResult || (result.text.length > (bestPartialResult.text?.length || 0)))) {
        bestPartialResult = result
      }

      lastError = result.error || 'Unknown chunked transcription error'
      lastErrorCode = categorizeTranscriptionError(lastError)
      
      const isRetryable = isTranscriptionErrorRetryable(lastErrorCode, lastError)
      
      if (!isRetryable || attempt === config.maxRetries) {
        return createTranscriptionErrorResult(
          lastError,
          lastErrorCode,
          warnings.concat(result.warnings || []),
          startTime,
          isRetryable,
          attempt,
          bestPartialResult?.text
        )
      }

      // Wait before retry
      const delay = 3000 * Math.pow(1.5, attempt - 1) // 3s, 4.5s, 6.75s, etc.
      onProgress?.({
        stage: 'processing',
        message: `Retry ${attempt}/${config.maxRetries} (chunked) in ${Math.round(delay/1000)}s...`,
        progress: 20 + (attempt * 10)
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      lastErrorCode = VideoImportErrorCode.UNKNOWN_ERROR
    }
  }

  return createTranscriptionErrorResult(
    lastError,
    lastErrorCode,
    warnings,
    startTime,
    false,
    config.maxRetries,
    bestPartialResult?.text
  )
} 