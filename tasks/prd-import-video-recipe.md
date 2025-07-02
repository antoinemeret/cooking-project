# Product Requirements Document: Import Recipe from Video

## Introduction/Overview

This feature enables users to import recipes from social media videos (Instagram, TikTok, YouTube Shorts) by simply pasting a video URL into the existing recipe import workflow. The system will automatically detect video links, extract and transcribe the audio content, and use AI to structure the spoken instructions into a clean, editable recipe format.

The primary goal is to transform verbal cooking instructions from social media videos into structured recipes that users can save, edit, and reuse in their personal recipe collection.

## Goals

1. **Seamless Integration**: Extend the current URL import functionality to automatically handle video links without requiring users to learn a new workflow
2. **Comprehensive Extraction**: Extract recipe title, ingredients, and instructions from both video audio and platform metadata
3. **User Control**: Provide detailed progress feedback and allow users to edit all extracted content before saving
4. **Performance**: Complete the entire process (download → transcribe → structure → present) in under 1 minute on typical development hardware
5. **Platform Coverage**: Support the three major short-form video platforms: Instagram, TikTok, and YouTube Shorts

## User Stories

### Primary User Story
**As a home cook**, I want to paste a link to a cooking video I found on Instagram/TikTok/YouTube Shorts, so that I can quickly add that recipe to my personal collection without having to manually transcribe the instructions.

### Secondary User Stories
- **As a busy user**, I want to see clear progress indicators during video processing, so that I know the system is working and approximately how long it will take
- **As a detail-oriented cook**, I want to review and edit the extracted recipe before saving, so that I can ensure accuracy and add any missing details
- **As a recipe collector**, I want the video source URL saved with my recipe, so that I can reference the original video later if needed

## Functional Requirements

### Core Functionality
1. **Video Link Detection**: The system must automatically detect when a pasted URL is a video link from supported platforms (Instagram, TikTok, YouTube Shorts)
2. **HTML Metadata Extraction**: The system must parse the video page HTML to extract title and any visible ingredients list using the existing traditional parser
3. **Audio Extraction**: The system must extract audio from the video using yt-dlp or similar tool
4. **Speech Transcription**: The system must transcribe the extracted audio to text using Whisper (local Ollama model)
5. **AI Processing**: The system must process the transcription with an LLM (Ollama + Deepseek) to extract structured recipe instructions
6. **Progress Tracking**: The system must display detailed progress steps (downloading, transcribing, processing, etc.) to the user
7. **Partial Results Handling**: The system must return partial results (e.g., just transcription) for manual editing when AI processing is incomplete
8. **User Editing**: The system must allow users to edit and supplement all extracted content before saving
9. **Integration**: The system must use the existing preview/edit dialog, validation rules, and tagging system
10. **Data Storage**: The system must save the source URL along with the recipe data using the existing Prisma structure

### Technical Requirements
11. **Local Processing**: All video processing must occur locally on the user's machine
12. **Temporary File Cleanup**: The system must delete temporary video files immediately after audio extraction
13. **Performance**: The entire process must complete in under 1 minute on typical development hardware
14. **Error Handling**: The system must gracefully handle failures and provide meaningful error messages
15. **Resource Management**: The system must efficiently manage memory and disk space during processing

## Non-Goals (Out of Scope)

- **Live Video Processing**: Processing videos that are currently being streamed or broadcast live
- **Private Video Access**: Accessing videos that require authentication or are not publicly available
- **Batch Processing**: Processing multiple videos simultaneously in a single operation
- **Video Quality Enhancement**: Improving audio quality or removing background noise beyond basic transcription
- **Advanced Video Analysis**: Analyzing visual content, reading text overlays, or identifying ingredients visually
- **Cloud Processing**: Using external APIs or cloud services for video processing
- **Long-Form Content**: Processing videos longer than 10 minutes (focus on short-form social media content)

## Design Considerations

### User Interface Integration
- Extend the existing "Import from URL" dialog to handle video links seamlessly
- Use the existing recipe preview/edit dialog for reviewing extracted content
- Display progress steps clearly: "Downloading video → Extracting audio → Transcribing speech → Processing with AI → Ready for review"
- Show estimated time remaining for each step when possible

### User Experience Flow
1. User pastes video URL in existing import dialog
2. System detects video link and shows "Processing video..." with progress steps
3. Each processing step shows clear status (downloading, transcribing, etc.)
4. Upon completion, user sees familiar preview/edit dialog with extracted content
5. User can edit title, ingredients, instructions, and tags before saving
6. Recipe is saved with source URL for future reference

### Error Handling
- If video download fails: Show clear error message with suggestions
- If transcription is poor: Return raw transcription for manual editing
- If AI processing fails: Return transcription with manual structuring option
- If no recipe content detected: Provide option to save as general note or try again

## Technical Considerations

### Architecture Integration
- **New Dedicated Route**: Create `/api/recipes/import-video/route.ts` following the same pattern as `/api/recipes/import-photo/`
- **Traditional Parser Integration**: Use existing HTML parsing logic for metadata extraction  
- **Prisma Integration**: Leverage existing recipe schema and validation
- **UI Components**: Reuse existing import dialog and preview components

### Dependencies
- **yt-dlp**: For video downloading and audio extraction
- **Ollama + Whisper**: For local audio transcription
- **Ollama + Deepseek**: For AI-powered recipe structuring
- **Existing Parsers**: Traditional HTML parsing for metadata

### Performance Optimization
- Stream audio extraction to avoid storing large video files
- Use Whisper tiny model for faster transcription
- Implement timeout mechanisms for each processing step
- Cache frequently accessed model files

### Data Privacy
- Process all content locally on user's machine
- Delete temporary video files immediately after audio extraction
- Provide user option to retain transcriptions for debugging
- Never transmit video content to external services

## Success Metrics

### Quantitative Metrics
- **Processing Time**: 95% of videos processed in under 1 minute
- **Success Rate**: 80% of videos successfully extract at least partial recipe content
- **User Adoption**: 25% of recipe imports use video feature within first month
- **Edit Rate**: Less than 50% of extracted recipes require significant editing

### Qualitative Metrics
- **User Satisfaction**: Users report video import as "easy to use" and "time-saving"
- **Content Quality**: Extracted recipes are generally accurate and well-structured
- **Error Handling**: Users understand what went wrong and how to proceed when errors occur

## Open Questions

1. **Platform-Specific Handling**: Should we implement different processing strategies for different platforms based on their typical content patterns?

2. **Transcription Quality Thresholds**: What minimum confidence level should we require from Whisper before sending to the LLM?

3. **Fallback Strategies**: If the primary AI model fails, should we have backup processing methods or model alternatives?

4. **User Preferences**: Should users be able to configure processing options (e.g., transcription model, AI prompt style)?

5. **Content Filtering**: Should we implement any filtering for non-recipe content or inappropriate material?

6. **Performance Monitoring**: How should we track processing performance and identify bottlenecks for future optimization?

7. **Multilingual Support**: Should we support videos in languages other than English, and if so, which languages first?

8. **Integration Testing**: How should we test the integration with existing recipe import workflows to ensure no regressions? 