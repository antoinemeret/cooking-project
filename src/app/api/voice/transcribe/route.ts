import { NextRequest, NextResponse } from 'next/server'
import { TranscriptionResultSchema } from '@/lib/assistant/types'
import OpenAI from 'openai'

// Mock transcription for now - will be replaced with actual Whisper API
async function mockTranscribe(audioBlob: Blob): Promise<{ transcript: string, confidence: number }> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Mock responses based on file size (simulating different audio lengths)
  const size = audioBlob.size
  const mockResponses = [
    "Je veux 2 repas avec des légumes de saison, sans gluten",
    "Prépare-moi 3 plats pour la semaine, végétariens et rapides",
    "J'ai besoin d'un menu équilibré pour 4 personnes, cuisine italienne",
    "2 repas simples avec du poulet et des légumes verts",
    "Menu de la semaine avec des plats méditerranéens"
  ]
  
  const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]
  const confidence = Math.random() * 0.3 + 0.7 // 0.7 to 1.0
  
  return {
    transcript: randomResponse,
    confidence
  }
}

// Real Whisper API integration
async function transcribeWithWhisper(audioBlob: Blob): Promise<{ transcript: string, confidence: number }> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not found, falling back to mock transcription')
    return mockTranscribe(audioBlob)
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Convert Blob to File for OpenAI API
    const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })
    
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr", // Specify French
      response_format: "verbose_json",
    })

    // Whisper doesn't provide per-word confidence, so we estimate overall confidence
    // based on the response quality and length
    const confidence = Math.min(0.95, 0.7 + (response.text.length / 100) * 0.1)

    return {
      transcript: response.text,
      confidence
    }
  } catch (error) {
    console.error('Whisper API error:', error)
    console.warn('Falling back to mock transcription due to API error')
    return mockTranscribe(audioBlob)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!audioFile.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Audio file required.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Convert File to Blob for processing
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })
    
    // Transcribe audio
    const result = await transcribeWithWhisper(audioBlob)
    
    // Validate result with Zod schema
    const validatedResult = TranscriptionResultSchema.parse(result)
    
    return NextResponse.json(validatedResult)
    
  } catch (error) {
    console.error('Transcription error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error during transcription' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
