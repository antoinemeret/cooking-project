# Tasks: Import Recipe from Video

Based on `prd-import-video-recipe.md`

## Relevant Files

- `src/app/api/recipes/import-video/route.ts` - New API route handler for video recipe imports (created)
- `src/app/api/recipes/import-video/route.test.ts` - Unit tests for the video import API route
- `src/lib/video-processor.ts` - Core video processing utilities for URL detection and platform handling (created)
- `src/lib/audio-extractor.ts` - Audio extraction functionality using yt-dlp with platform optimizations (created)
- `src/lib/speech-transcriber.ts` - Speech-to-text transcription using Ollama's Whisper model (created)
- `src/lib/ai-video-client.ts` - AI recipe structuring using Deepseek via Ollama for video transcriptions (created)
- `src/lib/video-processing-pipeline.ts` - Central orchestrator for complete video-to-recipe processing workflow (created)
- `src/lib/scrapers/traditional-parser.ts` - Enhanced with video metadata extraction (enhanced)
- `src/lib/video-processor.test.ts` - Unit tests for video processing functions
- `src/lib/scrapers/video-parser.test.ts` - Unit tests for video parser
- `src/lib/ai-video-client.ts` - AI client specifically for processing video transcriptions
- `src/lib/ai-video-client.test.ts` - Unit tests for AI video processing
- `src/lib/temp-file-manager.ts` - Temporary file management utilities for video/audio cleanup (created)
- `src/lib/video-url-validator.ts` - Comprehensive video URL validation with security checks (created)
- `src/types/video-import.ts` - Complete TypeScript types for video import API responses and processing (created)
- `src/lib/video-url-detector.ts` - Video URL detection utility for identifying video platforms (created)
- `src/app/recipes/data-table.tsx` - Enhanced existing import dialog to detect and handle video URLs (enhanced)
- `src/components/recipes/VideoImportDialog.test.tsx` - Unit tests for video import dialog
- `src/components/recipes/VideoProgressTracker.tsx` - Progress tracking component for video processing steps
- `src/components/recipes/VideoProgressTracker.test.tsx` - Unit tests for progress tracker
- `package.json` - Add yt-dlp and other video processing dependencies (yt-dlp-wrap added)
- `next.config.mjs` - Configuration for handling video processing in Next.js (configured with environment variables, timeouts, and API settings)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `VideoProcessor.tsx` and `VideoProcessor.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.
- Video processing dependencies may require system-level installations (yt-dlp, ffmpeg)
- Ollama models (Whisper, Deepseek) need to be available locally before testing

## Tasks

- [x] 1.0 Set up Video Processing Infrastructure
  - [x] 1.1 Install yt-dlp dependency and ensure it's available in the system PATH
  - [x] 1.2 Set up Ollama with whisper-tiny model for local transcription
  - [x] 1.3 Configure Ollama with Deepseek model for recipe structuring
  - [x] 1.4 Add video processing configuration to next.config.mjs
  - [x] 1.5 Create temporary file management utilities for video/audio cleanup
- [x] 2.0 Create Video Import API Route
  - [x] 2.1 Create `/api/recipes/import-video/route.ts` with POST endpoint
  - [x] 2.2 Implement request validation for video URLs
  - [x] 2.3 Add response types for video processing stages and results
  - [x] 2.4 Integrate with existing Prisma recipe schema for data storage
  - [x] 2.5 Add proper error handling and HTTP status codes
- [x] 3.0 Implement Video Detection and Processing Pipeline
  - [x] 3.1 Create video URL detection logic for Instagram, TikTok, YouTube Shorts
  - [x] 3.2 Implement HTML metadata extraction using existing traditional parser
  - [x] 3.3 Build audio extraction functionality using yt-dlp
  - [x] 3.4 Create speech-to-text transcription using Whisper via Ollama
  - [x] 3.5 Implement AI recipe structuring using Deepseek via Ollama
  - [x] 3.6 Add progress tracking and status updates throughout the pipeline
  - [x] 3.7 Implement temporary file cleanup after processing completion
- [x] 4.0 Extend Frontend Import Interface for Video URLs
  - [x] 4.1 Modify existing import dialog to detect and handle video URLs
  - [x] 4.2 Create progress tracking UI component for video processing steps
  - [x] 4.3 Add loading states and progress indicators for each processing phase
  - [x] 4.4 Integrate video processing results with existing preview/edit dialog
  - [x] 4.5 Handle partial results display when AI processing is incomplete
  - [x] 4.6 Add video source URL display in recipe preview
- [ ] 5.0 Add Error Handling and Resource Management
  - [ ] 5.1 Implement comprehensive error handling for video download failures
  - [ ] 5.2 Add error recovery for transcription and AI processing failures
  - [ ] 5.3 Create timeout mechanisms for each processing step (under 1 minute total)
  - [ ] 5.4 Implement resource cleanup on errors and cancellation
  - [ ] 5.5 Add performance monitoring and logging for processing bottlenecks
  - [ ] 5.6 Create user-friendly error messages with actionable suggestions 