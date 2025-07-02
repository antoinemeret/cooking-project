#!/usr/bin/env node

/**
 * Test Video Processing Components
 * Tests individual system components and validates the pipeline setup
 */

const { spawn } = require('child_process')
const https = require('https')
const http = require('http')

// Test configuration
const TEST_CONFIG = {
  videoUrl: 'https://www.instagram.com/reel/DLkae8iIrLR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',
  ollamaHost: 'http://localhost:11434',
  requiredModels: ['dimavz/whisper-tiny', 'deepseek-r1:latest']
}

console.log('🧪 Video Processing Components Test')
console.log('==================================')
console.log(`📹 Test URL: ${TEST_CONFIG.videoUrl}`)
console.log('\n🔧 System Dependency Checks...\n')

// Helper functions
function runCommand(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
    
    child.on('error', (error) => {
      resolve({ code: -1, stdout: '', stderr: error.message })
    })
  })
}

function makeRequest(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http
    const req = client.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data, error: null }))
    })
    
    req.on('error', (error) => {
      resolve({ status: 0, data: '', error: error.message })
    })
    
    req.setTimeout(10000, () => {
      req.abort()
      resolve({ status: 0, data: '', error: 'Request timeout' })
    })
  })
}

async function testSystemDependencies() {
  console.log('1️⃣  Testing yt-dlp...')
  
  const ytdlpTest = await runCommand('yt-dlp', ['--version'])
  if (ytdlpTest.code === 0) {
    console.log(`   ✅ yt-dlp available: ${ytdlpTest.stdout.trim()}`)
  } else {
    console.log(`   ❌ yt-dlp not found or not working`)
    console.log(`      Error: ${ytdlpTest.stderr}`)
    return false
  }

  console.log('\n2️⃣  Testing ffmpeg...')
  
  const ffmpegTest = await runCommand('ffmpeg', ['-version'])
  if (ffmpegTest.code === 0) {
    const version = ffmpegTest.stdout.split('\n')[0]
    console.log(`   ✅ ffmpeg available: ${version}`)
  } else {
    console.log(`   ❌ ffmpeg not found or not working`)
    console.log(`      Error: ${ffmpegTest.stderr}`)
    return false
  }

  console.log('\n3️⃣  Testing ffprobe...')
  
  const ffprobeTest = await runCommand('ffprobe', ['-version'])
  if (ffprobeTest.code === 0) {
    const version = ffprobeTest.stdout.split('\n')[0]
    console.log(`   ✅ ffprobe available: ${version}`)
  } else {
    console.log(`   ❌ ffprobe not found or not working`)
    console.log(`      Error: ${ffprobeTest.stderr}`)
    return false
  }

  return true
}

async function testOllamaService() {
  console.log('\n4️⃣  Testing Ollama service...')
  
  try {
    const response = await makeRequest(`${TEST_CONFIG.ollamaHost}/api/tags`)
    
    if (response.status === 200) {
      const models = JSON.parse(response.data)
      console.log(`   ✅ Ollama service running (${models.models?.length || 0} models available)`)
      
      if (models.models?.length > 0) {
        console.log('\n   📦 Available models:')
        models.models.forEach(model => {
          const size = model.size ? `(${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)` : ''
          console.log(`      - ${model.name} ${size}`)
        })
      }
      
      return models
    } else {
      console.log(`   ❌ Ollama service not responding (HTTP ${response.status})`)
      return null
    }
  } catch (error) {
    console.log(`   ❌ Cannot connect to Ollama service`)
    console.log(`      Error: ${error.message}`)
    return null
  }
}

async function testRequiredModels(availableModels) {
  console.log('\n5️⃣  Testing required AI models...')
  
  if (!availableModels || !availableModels.models) {
    console.log('   ❌ No models available to test')
    return false
  }

  let allModelsAvailable = true
  
  for (const requiredModel of TEST_CONFIG.requiredModels) {
    const modelExists = availableModels.models.some(model => 
      model.name === requiredModel || 
      model.name.startsWith(requiredModel.split(':')[0])
    )
    
    if (modelExists) {
      console.log(`   ✅ ${requiredModel} available`)
    } else {
      console.log(`   ❌ ${requiredModel} not found`)
      allModelsAvailable = false
    }
  }
  
  if (!allModelsAvailable) {
    console.log('\n   🛠️  Missing models can be installed with:')
    TEST_CONFIG.requiredModels.forEach(model => {
      if (!availableModels.models.some(m => m.name.startsWith(model.split(':')[0]))) {
        console.log(`      ollama pull ${model}`)
      }
    })
  }
  
  return allModelsAvailable
}

async function testVideoUrlValidation() {
  console.log('\n6️⃣  Testing video URL validation...')
  
  // Basic URL pattern tests
  const instagramPattern = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/
  const match = TEST_CONFIG.videoUrl.match(instagramPattern)
  
  if (match) {
    const videoId = match[1]
    console.log(`   ✅ Instagram reel URL detected`)
    console.log(`      Video ID: ${videoId}`)
    console.log(`      Platform: Instagram`)
  } else {
    console.log(`   ❌ URL pattern not recognized`)
    return false
  }
  
  return true
}

async function testVideoAccess() {
  console.log('\n7️⃣  Testing video accessibility...')
  
  try {
    console.log('   🔍 Testing yt-dlp access to video...')
    
    const ytdlpTest = await runCommand('yt-dlp', [
      '--dump-json',
      '--no-download',
      '--no-playlist',
      TEST_CONFIG.videoUrl
    ])
    
    if (ytdlpTest.code === 0) {
      try {
        const videoInfo = JSON.parse(ytdlpTest.stdout)
        console.log(`   ✅ Video accessible via yt-dlp`)
        console.log(`      Title: ${videoInfo.title || 'N/A'}`)
        console.log(`      Duration: ${videoInfo.duration || 'N/A'}s`)
        console.log(`      Uploader: ${videoInfo.uploader || 'N/A'}`)
        
        return videoInfo
      } catch (parseError) {
        console.log(`   ⚠️  Video accessible but metadata parsing failed`)
        console.log(`      Raw output length: ${ytdlpTest.stdout.length} chars`)
        return true
      }
    } else {
      console.log(`   ❌ Cannot access video with yt-dlp`)
      console.log(`      Error: ${ytdlpTest.stderr}`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Video access test failed`)
    console.log(`      Error: ${error.message}`)
    return false
  }
}

async function testAudioExtraction() {
  console.log('\n8️⃣  Testing audio extraction (dry run)...')
  
  try {
    console.log('   🔍 Testing yt-dlp audio extraction capabilities...')
    
    const ytdlpTest = await runCommand('yt-dlp', [
      '--list-formats',
      '--no-download',
      TEST_CONFIG.videoUrl
    ])
    
    if (ytdlpTest.code === 0) {
      const hasAudio = ytdlpTest.stdout.includes('audio') || ytdlpTest.stdout.includes('m4a') || ytdlpTest.stdout.includes('mp3')
      
      if (hasAudio) {
        console.log(`   ✅ Audio formats available for extraction`)
        
        // Show a few example formats
        const lines = ytdlpTest.stdout.split('\n')
        const audioLines = lines.filter(line => 
          line.includes('audio') || line.includes('m4a') || line.includes('mp3')
        ).slice(0, 3)
        
        if (audioLines.length > 0) {
          console.log('      Available audio formats:')
          audioLines.forEach(line => {
            console.log(`        ${line.trim()}`)
          })
        }
        
        return true
      } else {
        console.log(`   ⚠️  No clear audio formats detected`)
        return false
      }
    } else {
      console.log(`   ❌ Cannot list video formats`)
      console.log(`      Error: ${ytdlpTest.stderr}`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Audio extraction test failed`)
    console.log(`      Error: ${error.message}`)
    return false
  }
}

async function runComponentTests() {
  console.log('🚀 Starting component tests...\n')
  
  const results = {
    systemDependencies: false,
    ollamaService: false,
    requiredModels: false,
    urlValidation: false,
    videoAccess: false,
    audioExtraction: false
  }
  
  try {
    // Test 1: System dependencies
    results.systemDependencies = await testSystemDependencies()
    
    // Test 2: Ollama service
    const availableModels = await testOllamaService()
    results.ollamaService = !!availableModels
    
    // Test 3: Required models
    if (availableModels) {
      results.requiredModels = await testRequiredModels(availableModels)
    }
    
    // Test 4: URL validation
    results.urlValidation = await testVideoUrlValidation()
    
    // Test 5: Video access
    if (results.systemDependencies) {
      const videoInfo = await testVideoAccess()
      results.videoAccess = !!videoInfo
      
      // Test 6: Audio extraction
      if (results.videoAccess) {
        results.audioExtraction = await testAudioExtraction()
      }
    }
    
    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY')
    console.log('======================')
    
    const tests = [
      { name: 'System Dependencies (yt-dlp, ffmpeg)', result: results.systemDependencies },
      { name: 'Ollama Service', result: results.ollamaService },
      { name: 'Required AI Models', result: results.requiredModels },
      { name: 'Video URL Validation', result: results.urlValidation },
      { name: 'Video Accessibility', result: results.videoAccess },
      { name: 'Audio Extraction', result: results.audioExtraction }
    ]
    
    tests.forEach((test, index) => {
      const icon = test.result ? '✅' : '❌'
      console.log(`${index + 1}. ${icon} ${test.name}`)
    })
    
    const passedTests = tests.filter(t => t.result).length
    const totalTests = tests.length
    
    console.log(`\n🎯 Overall Results: ${passedTests}/${totalTests} tests passed`)
    
    if (passedTests === totalTests) {
      console.log('🎉 All systems ready! The video processing pipeline should work correctly.')
    } else {
      console.log('\n🛠️  Setup Requirements:')
      
      if (!results.systemDependencies) {
        console.log('   • Install yt-dlp: brew install yt-dlp (or pip install yt-dlp)')
        console.log('   • Install ffmpeg: brew install ffmpeg')
      }
      
      if (!results.ollamaService) {
        console.log('   • Install Ollama: https://ollama.ai/download')
        console.log('   • Start Ollama service: ollama serve')
      }
      
      if (!results.requiredModels) {
        console.log('   • Install required models:')
        console.log('     ollama pull dimavz/whisper-tiny')
        console.log('     ollama pull deepseek-r1:latest')
      }
    }
    
    console.log(`\n🔗 Test Video: ${TEST_CONFIG.videoUrl}`)
    
    return results

  } catch (error) {
    console.error('\n💥 Component tests failed:', error.message)
    throw error
  }
}

// Run the tests
if (require.main === module) {
  runComponentTests()
    .then((results) => {
      const allPassed = Object.values(results).every(result => result)
      
      if (allPassed) {
        console.log('\n✅ All component tests passed!')
        process.exit(0)
      } else {
        console.log('\n⚠️  Some tests failed. See setup requirements above.')
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error.message)
      process.exit(1)
    })
}

module.exports = { runComponentTests } 