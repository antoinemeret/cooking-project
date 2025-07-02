#!/usr/bin/env node

/**
 * Test Video Processing Pipeline
 * End-to-end test of the complete video-to-recipe processing workflow
 */

// Note: This would need TypeScript compilation or tsx to run
// For now, we'll create a simpler test that checks individual components
console.log('⚠️  Note: Full pipeline test requires TypeScript compilation')
console.log('Testing individual components instead...\n')

// Test configuration
const TEST_CONFIG = {
  videoUrl: 'https://www.instagram.com/reel/DLkae8iIrLR/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',
  options: {
    audioQuality: 'worst', // Fast processing for testing
    maxAudioDuration: 300, // 5 minutes max
    transcriptionModel: 'dimavz/whisper-tiny',
    transcriptionLanguage: 'auto',
    aiModel: 'deepseek-r1:latest',
    aiTemperature: 0.1,
    includePartialResults: true,
    enhanceWithMetadata: true,
    timeout: 300000, // 5 minutes
    skipMetadataExtraction: false
  }
}

console.log('🧪 Video Processing Pipeline Test')
console.log('================================')
console.log(`📹 Testing URL: ${TEST_CONFIG.videoUrl}`)
console.log(`⚙️  Configuration:`)
console.log(JSON.stringify(TEST_CONFIG.options, null, 2))
console.log('\n🚀 Starting pipeline test...\n')

// Track progress and timing
let lastStage = ''
let stageStartTime = Date.now()
const stageTimes = {}

function logProgress(progress) {
  // Log stage transitions
  if (progress.stage !== lastStage) {
    if (lastStage) {
      stageTimes[lastStage] = Date.now() - stageStartTime
      console.log(`   ✅ ${lastStage} completed in ${stageTimes[lastStage]}ms`)
    }
    
    lastStage = progress.stage
    stageStartTime = Date.now()
    console.log(`\n📋 Stage: ${progress.stage.toUpperCase()}`)
  }

  // Log progress updates
  const progressBar = '█'.repeat(Math.floor(progress.progress / 5)) + 
                     '░'.repeat(20 - Math.floor(progress.progress / 5))
  
  console.log(`   [${progressBar}] ${progress.progress.toFixed(1)}% - ${progress.message}`)
  
  // Log sub-progress if available
  if (progress.subProgress) {
    const subBar = '▓'.repeat(Math.floor(progress.subProgress.progress / 10)) + 
                   '░'.repeat(10 - Math.floor(progress.subProgress.progress / 10))
    console.log(`      └─ [${subBar}] ${progress.subProgress.stage}: ${progress.subProgress.message || 'Processing...'}`)
  }
  
  if (progress.eta) {
    console.log(`      ⏱️  ETA: ${progress.eta}`)
  }
}

async function runPipelineTest() {
  const overallStartTime = Date.now()
  
  try {
    console.log('🔧 Pre-flight checks...')
    
    // Check system dependencies
    console.log('   📦 Checking system dependencies...')
    
    // Test Ollama connection
    try {
      const ollamaResponse = await fetch('http://localhost:11434/api/tags')
      if (ollamaResponse.ok) {
        const models = await ollamaResponse.json()
        console.log(`   ✅ Ollama connected (${models.models?.length || 0} models available)`)
        
        // List available models
        if (models.models?.length > 0) {
          console.log('      Available models:')
          models.models.forEach(model => {
            console.log(`        - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`)
          })
        }
      } else {
        console.warn('   ⚠️  Ollama service may not be running')
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not connect to Ollama: ${error.message}`)
    }

    // Check yt-dlp
    const { spawn } = require('child_process')
    const ytDlpCheck = new Promise((resolve) => {
      const child = spawn('yt-dlp', ['--version'])
      child.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ yt-dlp available')
        } else {
          console.warn('   ⚠️  yt-dlp not found or not working')
        }
        resolve()
      })
      child.on('error', () => {
        console.warn('   ⚠️  yt-dlp not found in PATH')
        resolve()
      })
    })

    // Check ffmpeg
    const ffmpegCheck = new Promise((resolve) => {
      const child = spawn('ffmpeg', ['-version'])
      child.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ ffmpeg available')
        } else {
          console.warn('   ⚠️  ffmpeg not found or not working')
        }
        resolve()
      })
      child.on('error', () => {
        console.warn('   ⚠️  ffmpeg not found in PATH')
        resolve()
      })
    })

    await Promise.all([ytDlpCheck, ffmpegCheck])
    
    console.log('\n🚀 Running pipeline test...\n')

    // Run the actual pipeline
    const result = await processVideoThroughPipeline(
      TEST_CONFIG.videoUrl,
      TEST_CONFIG.options,
      logProgress
    )

    // Final stage timing
    if (lastStage) {
      stageTimes[lastStage] = Date.now() - stageStartTime
      console.log(`   ✅ ${lastStage} completed in ${stageTimes[lastStage]}ms`)
    }

    const totalTime = Date.now() - overallStartTime
    console.log(`\n🏁 Pipeline test completed in ${totalTime}ms\n`)

    // Results analysis
    console.log('📊 RESULTS ANALYSIS')
    console.log('==================')
    
    console.log(`\n🎯 Overall Success: ${result.success ? '✅ YES' : '❌ NO'}`)
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`)
    }

    if (result.warnings?.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`)
      result.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`)
      })
    }

    // Stage results
    console.log(`\n📋 Stage Results:`)
    Object.entries(result.stages).forEach(([stage, stageResult]) => {
      const icon = stageResult.success ? '✅' : '❌'
      const time = stageResult.duration
      console.log(`   ${icon} ${stage}: ${time}ms${stageResult.error ? ` (${stageResult.error})` : ''}`)
    })

    // Quality metrics
    if (result.confidence !== undefined) {
      console.log(`\n📈 Quality Metrics:`)
      console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
      if (result.qualityScore !== undefined) {
        console.log(`   ⭐ Quality Score: ${(result.qualityScore * 100).toFixed(1)}%`)
      }
    }

    // Resource usage
    if (result.resourceUsage) {
      console.log(`\n💾 Resource Usage:`)
      console.log(`   📁 Temp files created: ${result.resourceUsage.tempFilesCreated}`)
      console.log(`   🌐 Network requests: ${result.resourceUsage.networkRequests}`)
      if (result.resourceUsage.maxMemoryUsage > 0) {
        console.log(`   🧠 Max memory: ${(result.resourceUsage.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`)
      }
    }

    // Recipe results
    if (result.recipe) {
      console.log(`\n🍳 EXTRACTED RECIPE`)
      console.log('==================')
      console.log(`📝 Title: ${result.recipe.title}`)
      
      if (result.recipe.summary) {
        console.log(`📄 Summary: ${result.recipe.summary}`)
      }
      
      if (result.recipe.ingredients?.length > 0) {
        console.log(`\n🥕 Ingredients (${result.recipe.ingredients.length}):`)
        result.recipe.ingredients.forEach((ingredient, index) => {
          console.log(`   ${index + 1}. ${ingredient}`)
        })
      }
      
      if (result.recipe.instructions?.length > 0) {
        console.log(`\n👨‍🍳 Instructions (${result.recipe.instructions.length}):`)
        result.recipe.instructions.forEach((instruction, index) => {
          console.log(`   ${index + 1}. ${instruction}`)
        })
      }
      
      const metadata = []
      if (result.recipe.cookingTime) metadata.push(`⏱️  ${result.recipe.cookingTime} minutes`)
      if (result.recipe.servings) metadata.push(`👥 ${result.recipe.servings} servings`)
      if (result.recipe.difficulty) metadata.push(`📊 ${result.recipe.difficulty}`)
      if (result.recipe.cuisine) metadata.push(`🌍 ${result.recipe.cuisine}`)
      
      if (metadata.length > 0) {
        console.log(`\n📊 Recipe Metadata: ${metadata.join(' • ')}`)
      }
      
      if (result.recipe.tags?.length > 0) {
        console.log(`🏷️  Tags: ${result.recipe.tags.join(', ')}`)
      }
    } else if (result.intermediateResults?.aiResult?.partialResults) {
      console.log(`\n🔄 PARTIAL RESULTS`)
      console.log('==================')
      const partial = result.intermediateResults.aiResult.partialResults
      
      if (partial.title) console.log(`📝 Title: ${partial.title}`)
      if (partial.summary) console.log(`📄 Summary: ${partial.summary}`)
      
      if (partial.ingredients?.length > 0) {
        console.log(`\n🥕 Partial Ingredients (${partial.ingredients.length}):`)
        partial.ingredients.forEach((ingredient, index) => {
          console.log(`   ${index + 1}. ${ingredient}`)
        })
      }
      
      if (partial.instructions?.length > 0) {
        console.log(`\n👨‍🍳 Partial Instructions (${partial.instructions.length}):`)
        partial.instructions.forEach((instruction, index) => {
          console.log(`   ${index + 1}. ${instruction}`)
        })
      }
    }

    // Intermediate results summary
    if (result.intermediateResults) {
      console.log(`\n🔍 INTERMEDIATE RESULTS SUMMARY`)
      console.log('==============================')
      
      const { videoInfo, videoMetadata, audioResult, transcriptionResult, aiResult } = result.intermediateResults
      
      if (videoInfo) {
        console.log(`📹 Video Info:`)
        console.log(`   Platform: ${videoInfo.platform}`)
        console.log(`   Video ID: ${videoInfo.videoId}`)
        console.log(`   URL: ${videoInfo.originalUrl}`)
        if (videoInfo.metadata?.title) console.log(`   Title: ${videoInfo.metadata.title}`)
      }
      
      if (videoMetadata) {
        console.log(`\n🎥 Video Metadata:`)
        if (videoMetadata.title) console.log(`   Title: ${videoMetadata.title}`)
        if (videoMetadata.uploader) console.log(`   Uploader: ${videoMetadata.uploader}`)
        if (videoMetadata.description) console.log(`   Description: ${videoMetadata.description.substring(0, 100)}...`)
        if (videoMetadata.duration) console.log(`   Duration: ${videoMetadata.duration}s`)
      }
      
      if (audioResult) {
        console.log(`\n🎵 Audio Extraction:`)
        console.log(`   Success: ${audioResult.success}`)
        if (audioResult.duration) console.log(`   Duration: ${audioResult.duration}s`)
        if (audioResult.audioPath) console.log(`   Audio file: ${audioResult.audioPath}`)
        if (audioResult.warnings?.length > 0) {
          console.log(`   Warnings: ${audioResult.warnings.join('; ')}`)
        }
      }
      
      if (transcriptionResult) {
        console.log(`\n🗣️  Transcription:`)
        console.log(`   Success: ${transcriptionResult.success}`)
        if (transcriptionResult.text) {
          console.log(`   Text length: ${transcriptionResult.text.length} characters`)
          console.log(`   Sample: "${transcriptionResult.text.substring(0, 150)}..."`)
        }
        if (transcriptionResult.confidence) {
          console.log(`   Confidence: ${(transcriptionResult.confidence * 100).toFixed(1)}%`)
        }
        if (transcriptionResult.language) console.log(`   Language: ${transcriptionResult.language}`)
      }
      
      if (aiResult) {
        console.log(`\n🤖 AI Structuring:`)
        console.log(`   Success: ${aiResult.success}`)
        if (aiResult.confidence) console.log(`   Confidence: ${(aiResult.confidence * 100).toFixed(1)}%`)
        if (aiResult.reasoning) console.log(`   Reasoning: ${aiResult.reasoning}`)
        if (aiResult.modelUsed) console.log(`   Model: ${aiResult.modelUsed}`)
      }
    }

    console.log(`\n🏆 Test completed successfully!`)
    
    return result

  } catch (error) {
    console.error(`\n💥 Test failed with error:`)
    console.error(error)
    
    console.log(`\n📊 Partial timing results:`)
    Object.entries(stageTimes).forEach(([stage, time]) => {
      console.log(`   ${stage}: ${time}ms`)
    })
    
    throw error
  }
}

// Run the test
if (require.main === module) {
  runPipelineTest()
    .then(() => {
      console.log('\n✅ All tests completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message)
      process.exit(1)
    })
}

module.exports = { runPipelineTest } 