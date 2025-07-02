/**
 * Speech Transcriber
 * Handles speech-to-text transcription using Ollama's Whisper model
 */

import { promises as fs } from 'fs'
import { spawn } from 'child_process'

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
  warnings?: string[]
  processingTime?: number
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
 * Transcribe audio file using Ollama's Whisper model
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
      return {
        success: false,
        error: audioValidation.error || 'Invalid audio file',
        warnings
      }
    }

    // Step 2: Check if Ollama is available and model is ready
    onProgress?.({ stage: 'loading', message: 'Checking Ollama service and model...', progress: 10 })
    
    const modelCheck = await checkOllamaModel(config.model)
    if (!modelCheck.available) {
      return {
        success: false,
        error: modelCheck.error || 'Ollama model not available',
        warnings
      }
    }

    // Step 3: Determine if we need to chunk the audio
    const audioInfo = audioValidation.info!
    const needsChunking = audioInfo.duration && audioInfo.duration > config.chunkSize

    if (needsChunking) {
      onProgress?.({ stage: 'processing', message: 'Processing audio in chunks...', progress: 20 })
      return await transcribeInChunks(audioPath, audioInfo, config, onProgress, warnings, startTime)
    } else {
      onProgress?.({ stage: 'processing', message: 'Transcribing audio...', progress: 20 })
      return await transcribeSingle(audioPath, audioInfo, config, onProgress, warnings, startTime)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.({ stage: 'failed', message: `Transcription failed: ${errorMessage}` })

    return {
      success: false,
      error: `Transcription failed: ${errorMessage}`,
      warnings,
      processingTime: Date.now() - startTime
    }
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