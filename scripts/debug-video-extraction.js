const { spawn } = require('child_process')
const path = require('path')

// Test the exact same logic as our API
function buildYtDlpArgs(url, outputPath) {
  const args = [
    url,
    '--extract-audio',
    '--audio-format', 'wav',
    '--audio-quality', '5',
    '--output', outputPath.replace(/\.[^.]+$/, '.%(ext)s'),
    '--no-playlist',
    '--no-warnings',
    '--user-agent', 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36'
  ]

  // Add sample rate configuration
  args.push('--postprocessor-args', 'ffmpeg:-ar 16000')

  return args
}

async function testVideoExtraction() {
  const url = 'https://www.youtube.com/shorts/UxRqo6004Ug'
  const outputPath = '/tmp/debug_audio.wav'

  const args = buildYtDlpArgs(url, outputPath)
  
  console.log('Testing yt-dlp with args:', args)
  console.log('Full command:', `yt-dlp ${args.join(' ')}`)

  const child = spawn('yt-dlp', args)

  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString())
  })

  child.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString())
  })

  child.on('close', (code) => {
    console.log(`Process exited with code: ${code}`)
    if (code === 0) {
      console.log('SUCCESS: Audio extraction completed')
    } else {
      console.log('FAILED: Audio extraction failed')
    }
  })

  child.on('error', (error) => {
    console.log('ERROR:', error.message)
  })
}

testVideoExtraction() 