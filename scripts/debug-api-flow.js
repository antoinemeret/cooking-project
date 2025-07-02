const { spawn } = require('child_process')
const { promises: fs } = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

// Mimic our temp file manager
const tempDir = process.env.VIDEO_TEMP_DIR || '/tmp/video-processing'

async function ensureTempDir() {
  try {
    await fs.mkdir(tempDir, { recursive: true })
    console.log(`Temp directory ensured: ${tempDir}`)
  } catch (error) {
    console.error(`Failed to create temp directory: ${error}`)
    throw error
  }
}

function createTempPath(extension) {
  const filename = `${randomUUID()}.${extension.replace('.', '')}`
  return path.join(tempDir, filename)
}

// Build yt-dlp args like our API
function buildYtDlpArgs(url, outputPath) {
  const args = [
    url,
    '--extract-audio',
    '--audio-format', 'wav',
    '--audio-quality', '5',
    '--output', outputPath.replace(/\.[^.]+$/, '.%(ext)s'),
    '--no-playlist',
    '--no-warnings',
    '--user-agent', 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
    '--postprocessor-args', 'ffmpeg:-ar 16000'
  ]
  return args
}

async function testApiFlow() {
  console.log('=== Testing API Flow ===')
  
  try {
    // Step 1: Ensure temp directory exists
    await ensureTempDir()
    
    // Step 2: Create temp file path
    const tempAudioPath = createTempPath('wav')
    console.log(`Temp audio path: ${tempAudioPath}`)
    
    // Step 3: Build yt-dlp args
    const url = 'https://www.youtube.com/shorts/UxRqo6004Ug'
    const args = buildYtDlpArgs(url, tempAudioPath)
    
    console.log('yt-dlp args:', args)
    
    // Step 4: Run yt-dlp
    console.log('Starting yt-dlp process...')
    const result = await new Promise((resolve) => {
      const child = spawn('yt-dlp', args)
      
      child.stdout.on('data', (data) => {
        console.log('STDOUT:', data.toString().trim())
      })
      
      child.stderr.on('data', (data) => {
        console.log('STDERR:', data.toString().trim())
      })
      
      child.on('close', (code) => {
        console.log(`Process exited with code: ${code}`)
        resolve({ success: code === 0, code })
      })
      
      child.on('error', (error) => {
        console.log('Process error:', error.message)
        resolve({ success: false, error: error.message })
      })
    })
    
    // Step 5: Check if file was created
    if (result.success) {
      try {
        const stats = await fs.stat(tempAudioPath)
        console.log(`SUCCESS: Audio file created, size: ${stats.size} bytes`)
        
        // Cleanup
        await fs.unlink(tempAudioPath)
        console.log('Cleanup completed')
      } catch (statError) {
        console.log('ERROR: Could not find output file:', statError.message)
      }
    } else {
      console.log('FAILED: yt-dlp process failed')
    }
    
  } catch (error) {
    console.error('API flow test failed:', error.message)
  }
}

testApiFlow() 