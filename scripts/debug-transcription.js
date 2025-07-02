const { Ollama } = require('ollama')
const { promises: fs } = require('fs')

async function testTranscription() {
  try {
    console.log('Testing Ollama Whisper transcription...')
    
    const ollama = new Ollama()
    
    // Test if models are available
    console.log('Checking available models...')
    const models = await ollama.list()
    console.log('Available models:', models.models.map(m => m.name))
    
    // Check if whisper model is available
    const whisperModel = models.models.find(m => m.name.includes('whisper'))
    if (!whisperModel) {
      console.log('❌ No Whisper model found!')
      return
    }
    console.log('✅ Found Whisper model:', whisperModel.name)
    
    // Test transcription with our audio file
    const audioPath = '/tmp/debug_audio.wav'
    console.log(`Reading audio file: ${audioPath}`)
    
    const audioBuffer = await fs.readFile(audioPath)
    const audioBase64 = audioBuffer.toString('base64')
    
    console.log(`Audio file size: ${audioBuffer.length} bytes`)
    console.log(`Base64 size: ${audioBase64.length} characters`)
    
    console.log('Sending to Ollama for transcription...')
    const response = await ollama.generate({
      model: 'ZimaBlueAI/whisper-large-v3:latest',
      prompt: 'Transcribe this audio file',
      images: [audioBase64],
      stream: false
    })

    console.log('Transcription response:', response.response)
    
    if (response.response && response.response.trim()) {
      console.log('✅ Transcription successful!')
    } else {
      console.log('❌ Transcription returned empty result')
    }
    
  } catch (error) {
    console.error('❌ Transcription failed:', error.message)
    console.error('Full error:', error)
  }
}

testTranscription() 