/** @type {import('next').NextConfig} */
const nextConfig = {
  // Video processing configuration
  experimental: {
    // Enable server-side file handling for video processing
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000'],
      // Increase body size limit for video processing
      bodySizeLimit: '10mb'
    }
  },

  // Webpack configuration for video processing dependencies
  webpack: (config, { isServer }) => {
    // Handle yt-dlp and other video processing binaries
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'yt-dlp': 'commonjs yt-dlp'
      })
    }

    // Handle file operations for temporary video files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false
    }

    return config
  },

  // Environment variables for video processing
  env: {
    // Temporary file directory for video processing
    VIDEO_TEMP_DIR: process.env.VIDEO_TEMP_DIR || '/tmp/video-processing',
    // Maximum video processing time (in milliseconds)
    VIDEO_PROCESSING_TIMEOUT: process.env.VIDEO_PROCESSING_TIMEOUT || '60000',
    // Ollama configuration
    OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
    // Video processing feature flag
    ENABLE_VIDEO_IMPORT: process.env.ENABLE_VIDEO_IMPORT || 'true'
  },

  // Headers configuration for video processing API routes
  async headers() {
    return [
      {
        source: '/api/recipes/import-video/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ]
  },

  // Redirects for video processing (if needed)
  async redirects() {
    return []
  },

  // Image configuration (existing functionality)
  images: {
    domains: ['localhost'],
    // Add video thumbnail domains if needed
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  }
}

export default nextConfig
