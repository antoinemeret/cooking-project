// Test URL validation
const url = 'https://www.youtube.com/shorts/UxRqo6004Ug'

console.log('Testing URL validation for:', url)

// Test basic URL validation
try {
  const urlObj = new URL(url)
  console.log('✅ Basic URL parsing successful')
  console.log('Protocol:', urlObj.protocol)
  console.log('Hostname:', urlObj.hostname)
  console.log('Pathname:', urlObj.pathname)
} catch (error) {
  console.log('❌ Basic URL parsing failed:', error.message)
}

// Test YouTube pattern matching
const youtubePatterns = [
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/,
  /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/,
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+.*[&#]t=\d+s?/,
  /^https?:\/\/(m\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/
]

console.log('\nTesting YouTube patterns:')
youtubePatterns.forEach((pattern, index) => {
  const matches = pattern.test(url)
  console.log(`Pattern ${index + 1}: ${matches ? '✅' : '❌'} ${pattern}`)
})

// Test video ID extraction
const ytMatch = url.match(/\/shorts\/([A-Za-z0-9_-]+)/)
console.log('\nVideo ID extraction:')
console.log('Match result:', ytMatch)
console.log('Video ID:', ytMatch ? ytMatch[1] : 'Not found')

// Test platform detection logic
function detectPlatform(url) {
  const PLATFORM_PATTERNS = {
    youtube: [
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+.*[&#]t=\d+s?/,
      /^https?:\/\/(m\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+/
    ]
  }
  
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return platform
    }
  }
  return null
}

console.log('\nPlatform detection:')
const detectedPlatform = detectPlatform(url)
console.log('Detected platform:', detectedPlatform || 'None')

// Test complete validation function (simplified)
function validateVideoUrl(url) {
  // Basic validation
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required and must be a string' }
  }

  // URL format validation
  try {
    new URL(url)
  } catch {
    return { isValid: false, error: 'Invalid URL format' }
  }

  // Platform detection
  const platform = detectPlatform(url)
  if (!platform) {
    return { isValid: false, error: 'Unsupported platform' }
  }

  return { isValid: true, platform }
}

console.log('\nComplete validation:')
const validationResult = validateVideoUrl(url)
console.log('Validation result:', validationResult) 