'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { toast } from 'sonner'
import { detectVideoUrl, getPlatformDisplayName } from "@/lib/video-url-detector"
import { VideoProcessingProgress, VideoProcessingStage } from "@/components/recipes/VideoProgressTracker"
import { ExtractedRecipeData, VideoPlatform } from "@/types/video-import"

export function useAddRecipe() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [isUrlInputDialogOpen, setIsUrlInputDialogOpen] = useState(false)
  const [importUrl, setImportUrl] = useState("")
  const [importError, setImportError] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState("Add new")
  const [importedRecipe, setImportedRecipe] = useState<any>(null)
  const [isVideoProcessing, setIsVideoProcessing] = useState(false)
  const [videoProgress, setVideoProgress] = useState<VideoProcessingProgress | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleManualAdd = () => {
    setIsImportDialogOpen(true)
    setIsManualMode(true)
  }

  const handleLinkAdd = () => {
    setIsUrlInputDialogOpen(true)
  }

  const handlePhotoAdd = () => {
    console.log('📸 handlePhotoAdd called')
    console.log('📸 photoInputRef.current:', photoInputRef.current)
    if (photoInputRef.current) {
      console.log('📸 Clicking file input...')
      photoInputRef.current.click()
    } else {
      console.error('📸 photoInputRef.current is null!')
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    console.log('📸 handleFileChange called')
    console.log('📸 event.target.files:', event.target.files)
    const file = event.target.files?.[0]
    if (!file) {
      console.log('📸 No file selected')
      return
    }
    console.log('📸 File selected:', file.name, file.type, file.size)

    setIsImporting(true)
    setImportStatus("Uploading...")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      })

      if (!response.ok || !response.body) {
        throw new Error("Upload failed")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const eventData = JSON.parse(line)
            
            if (eventData.status) {
              setImportStatus(eventData.status)
            }

            if (eventData.status === 'done' && eventData.data) {
              const photoRecipeData = eventData.data
              console.log('📸 Photo import response data (mobile):', photoRecipeData)
              
              // Create the recipe object for the review dialog
              const photoRecipe = {
                title: photoRecipeData.title,
                rawIngredients: photoRecipeData.rawIngredients || [],
                instructions: photoRecipeData.instructions || '',
                suggestedTags: photoRecipeData.suggestedTags || [],
                candidateImages: []
              }
              
              // Open the review dialog instead of just showing a toast
              setImportedRecipe(photoRecipe)
              setIsImportDialogOpen(true)
              setIsManualMode(false)
              toast.success("Recipe extracted successfully!")
            }

            if (eventData.status === 'error') {
              throw new Error(eventData.error || 'Photo processing failed')
            }
          } catch (parseError) {
            console.error('Error parsing photo import event (mobile):', parseError)
            console.error('Problematic line:', line)
          }
        }
      }
    } catch (error) {
      console.error("Photo import error (mobile):", error)
      toast.error("Failed to import recipe from photo")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  const handleVideoUrlImport = async (url: string, platform: any) => {
    const platformName = getPlatformDisplayName(platform)
    
    // Initialize video processing state
    setIsVideoProcessing(true)
    setVideoProgress({
      stage: 'analyzing',
      message: `Initializing ${platformName} video processing...`,
      platform: platformName,
      timestamp: Date.now()
    })
    setImportStatus(`Processing ${platformName} video...`)
    
    let videoRecipe: any = null
    try {
      const response = await fetch('/api/recipes/import-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Video import failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const eventData = JSON.parse(line)
            
            if (eventData.status) {
              // Map API status to VideoProcessingStage
              const stageMapping: Record<string, VideoProcessingStage> = {
                analyzing: 'analyzing',
                downloading: 'downloading', 
                transcribing: 'transcribing',
                structuring: 'structuring',
                done: 'done',
                error: 'error'
              }

              const stage = stageMapping[eventData.status] || 'analyzing'
              
              // Update video progress with detailed information
              setVideoProgress({
                stage,
                message: eventData.message || eventData.status,
                platform: platformName,
                timestamp: Date.now(),
                error: eventData.error
              })

              // Update import status for backwards compatibility
              const statusMessages: Record<string, string> = {
                analyzing: 'Analyzing video URL...',
                downloading: 'Downloading video content...',
                transcribing: 'Converting speech to text...',
                structuring: 'Extracting recipe information...',
                done: 'Processing complete!',
                error: 'Processing failed'
              }
              setImportStatus(statusMessages[eventData.status] || `Processing ${eventData.status}...`)
            }

            if (eventData.status === 'done' && eventData.data) {
              // Convert video import response to expected format with metadata
              const videoRecipeData: ExtractedRecipeData = eventData.data
              console.log('🎬 Video import response data (mobile):', videoRecipeData)
              videoRecipe = {
                title: videoRecipeData.title,
                rawIngredients: videoRecipeData.rawIngredients || [],
                instructions: videoRecipeData.instructions || '',
                sourceUrl: videoRecipeData.sourceUrl,
                transcription: videoRecipeData.transcription,
                videoMetadata: videoRecipeData.metadata ? {
                  platform: videoRecipeData.metadata.platform,
                  videoId: videoRecipeData.metadata.videoId,
                  duration: videoRecipeData.metadata.duration,
                  extractedAt: videoRecipeData.metadata.extractedAt || new Date().toISOString()
                } : {
                  platform: platform.toLowerCase() as VideoPlatform,
                  extractedAt: new Date().toISOString()
                },
                suggestedTags: videoRecipeData.suggestedTags || [],
                candidateImages: videoRecipeData.candidateImages || []
              }
            }

            if (eventData.status === 'error') {
              throw new Error(eventData.error || 'Video processing failed')
            }
          } catch (parseError) {
            console.error('Error parsing video import event (mobile):', parseError)
            console.error('Problematic line:', line)
          }
        }
      }
    } catch (error) {
      console.error('Video import error (mobile):', error)
      setImportError(`Failed to import video: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsVideoProcessing(false)
      setVideoProgress(null)
      setIsImporting(false)
      setImportStatus("Add new")
    }
    
    return videoRecipe
  }

  const handleUrlSubmit = async () => {
    if (!importUrl.trim()) {
      setImportError("Please enter a URL")
      return
    }

    setIsImporting(true)
    setImportError("")
    setImportStatus("Processing URL...")

    try {
      // Detect if this is a video URL
      const videoDetection = detectVideoUrl(importUrl)
      let success = false
      let newRecipe: any = null
      
      if (videoDetection.isVideoUrl) {
        console.log('🎬 Video URL detected, using video import workflow')
        const videoRecipe = await handleVideoUrlImport(importUrl, videoDetection.platform)
        success = !!videoRecipe
        newRecipe = videoRecipe
      } else {
        console.log('🔗 Regular URL detected, using scrape workflow')
        const response = await fetch("/api/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: importUrl }),
        })

        if (!response.ok) {
          throw new Error("URL import failed")
        }

        const result = await response.json()
        console.log('🔗 URL import response (mobile):', result)
        
        if (result.recipe) {
          success = true
          newRecipe = {
            title: result.recipe.title,
            rawIngredients: result.recipe.rawIngredients || [],
            instructions: result.recipe.instructions || '',
            suggestedTags: result.recipe.suggestedTags || [],
            candidateImages: result.images || []
          }
        } else {
          throw new Error(result.error || "No recipe data received")
        }
      }

      if (success && newRecipe) {
        // Open the review dialog
        setImportedRecipe(newRecipe)
        setIsImportDialogOpen(true)
        setIsManualMode(false)
        setIsUrlInputDialogOpen(false)
        setImportUrl("")
        toast.success("Recipe extracted successfully!")
      } else {
        throw new Error("Failed to extract recipe")
      }
    } catch (error) {
      console.error("URL import error:", error)
      setImportError("Failed to import recipe from URL")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  return {
    // State
    isImportDialogOpen,
    setIsImportDialogOpen,
    isManualMode,
    setIsManualMode,
    isUrlInputDialogOpen,
    setIsUrlInputDialogOpen,
    importUrl,
    setImportUrl,
    importError,
    setImportError,
    isImporting,
    importStatus,
    importedRecipe,
    setImportedRecipe,
    isVideoProcessing,
    videoProgress,
    photoInputRef,
    
    // Handlers
    handleManualAdd,
    handleLinkAdd,
    handlePhotoAdd,
    handleFileChange,
    handleUrlSubmit,
  }
}
