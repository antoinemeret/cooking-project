import { NextRequest, NextResponse } from 'next/server'
import { TranscriptionResultSchema } from '@/lib/assistant/types'

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

// TODO: Replace with actual Whisper API integration
async function transcribeWithWhisper(audioBlob: Blob): Promise<{ transcript: string, confidence: number }> {
  // This would be the actual Whisper API implementation
  // For now, we'll use the mock function
  return mockTranscribe(audioBlob)
  
  /* 
  // Example of how to integrate with OpenAI Whisper API:
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'fr') // French
  formData.append('response_format', 'verbose_json')
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData
  })
  
  if (!response.ok) {
    throw new Error(`Whisper API error: ${response.status}`)
  }
  
  const result = await response.json()
  return {
    transcript: result.text,
    confidence: result.segments?.[0]?.avg_logprob ? Math.exp(result.segments[0].avg_logprob) : 0.8
  }
  */
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
