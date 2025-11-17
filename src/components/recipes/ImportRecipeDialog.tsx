'use client'

import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VideoProgressTracker, VideoProcessingProgress } from '@/components/recipes/VideoProgressTracker'
import { TagInput } from '@/components/ui/tag-input'
import { CheckCircle2, Upload } from 'lucide-react'
import { toast } from 'sonner'

type ImportedRecipe = {
  id?: number
  title: string
  rawIngredients: string[]
  instructions: string
  tags?: string[]
  suggestedTags?: string[]
  candidateImages?: string[]
  sourceUrl?: string
  transcription?: string
  preparationTime?: number
  cookingTime?: number
  videoMetadata?: {
    platform: string
    extractedAt: string
  }
}

type ImportRecipeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipe: ImportedRecipe | null
  setRecipe: (recipe: ImportedRecipe | null) => void
  isManualMode: boolean
  setIsManualMode: (isManual: boolean) => void
  onImport: () => void
  setProcessingRecipeId: (id: number | null) => void
  url: string
  setUrl: (url: string) => void
  onUrlImport: () => void
  loading: boolean
  error: string
  videoProgress: VideoProcessingProgress | null
  isVideoProcessing: boolean
  onRefresh: () => void
}

export function ImportRecipeDialog({
  open,
  onOpenChange,
  recipe,
  setRecipe,
  isManualMode,
  setIsManualMode,
  onImport,
  setProcessingRecipeId,
  url,
  setUrl,
  onUrlImport,
  loading,
  error,
  videoProgress,
  isVideoProcessing,
  onRefresh,
}: ImportRecipeDialogProps) {
  // --- State hooks: must be at the top ---
  const [title, setTitle] = useState(recipe?.title || '')
  const [ingredients, setIngredients] = useState((recipe?.rawIngredients || []).join('\n'))
  const [instructions, setInstructions] = useState(recipe?.instructions || '')
  const [tags, setTags] = useState<string[]>(recipe?.tags || [])
  const [isSaving, setIsSaving] = useState(false)
  // Image picker state
  const [candidateImages, setCandidateImages] = useState<string[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)

  // Sync dialog fields with recipe prop
  useEffect(() => {
    setTitle(recipe?.title || '')
    setIngredients((recipe?.rawIngredients || []).join('\n'))
    setInstructions(recipe?.instructions || '')
    setTags(recipe?.tags || [])
    // Update candidateImages whenever recipe changes, regardless of dialog open state
    if (recipe) {
      console.log('🖼️ Recipe updated, candidateImages:', recipe.candidateImages)
      setCandidateImages(recipe.candidateImages || [])
      setSelectedImageIdx(0)
      setUploadedImage(null)
      setUploadedPreview(null)
    }
  }, [recipe])

  // Only reset candidateImages when dialog is closed
  useEffect(() => {
    if (!open) {
      setCandidateImages([])
      setSelectedImageIdx(0)
      setUploadedImage(null)
      setUploadedPreview(null)
    }
  }, [open])

  function handleImageSelect(idx: number) {
    setSelectedImageIdx(idx)
    setUploadedImage(null)
    setUploadedPreview(null)
  }

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      setUploadedPreview(URL.createObjectURL(file))
    }
  }

  function handleReset() {
    setIsManualMode(false)
    setRecipe(null)
    setUrl('')
  }

  // Add suggested tag handler
  function handleAddSuggestedTag(tag: string) {
    if (!tags.includes(tag)) setTags([...tags, tag])
  }

  // Define handleSave with backend call
  async function handleSave() {
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) {
      toast.error('Please fill in all fields', {
        description: 'Title, ingredients, and instructions are required'
      })
      return
    }

    // Prevent multiple saves
    if (isSaving) {
      toast.warning('Saving in progress', {
        description: 'Please wait while we save your recipe...'
      })
      return
    }

    setIsSaving(true)
    
    // Show initial loading toast
    const toastId = toast.loading('Saving recipe...', {
      description: 'Creating your recipe in the database'
    })

    try {
      // Prepare recipe data for backend
      const recipeData = {
        title: title.trim(),
        rawIngredients: ingredients.split('\n').map(line => line.trim()).filter(Boolean),
        instructions: instructions.trim(),
        tags: JSON.stringify(tags),
        // Include selected image URL if user selected a candidate image
        selectedImageUrl: candidateImages[selectedImageIdx] || null,
        // Include preparationTime and cookingTime if they exist (from video import)
        preparationTime: recipe?.preparationTime,
        cookingTime: recipe?.cookingTime
      }

      // Update toast - saving recipe
      toast.loading('Saving recipe...', {
        id: toastId,
        description: 'Saving recipe details to database'
      })

      // Call existing backend endpoint
      console.log('💾 Calling /api/recipes with data:', {
        title: recipeData.title,
        rawIngredientsCount: recipeData.rawIngredients.length,
        instructionsLength: recipeData.instructions.length,
        hasTags: !!recipeData.tags,
        hasSelectedImage: !!recipeData.selectedImageUrl
      })
      
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Recipe save failed:', errorData)
        throw new Error(errorData.error || 'Failed to save recipe')
      }

      const responseData = await response.json()
      const { recipe: savedRecipe, imageDownloadStatus, imageDownloadMessage } = responseData
      
      console.log('✅ Recipe saved successfully:', {
        id: savedRecipe.id,
        title: savedRecipe.title,
        imageDownloadStatus,
        hasInstructions: !!savedRecipe.instructions,
        hasRawIngredients: !!savedRecipe.rawIngredients
      })
      
      console.log('🔄 Async workflows should be triggered for recipe', savedRecipe.id)

      // Update toast - processing image if needed
      if (uploadedImage || (imageDownloadStatus === 'success' || imageDownloadStatus === 'failed')) {
        toast.loading('Processing image...', {
          id: toastId,
          description: 'Uploading and optimizing recipe image'
        })
      }

      // --- Handle user-uploaded image separately ---
      if (uploadedImage) {
        // User uploaded a new image - use the upload-image endpoint
        try {
          const formData = new FormData()
          formData.append('file', uploadedImage)
          formData.append('recipeId', savedRecipe.id)
          const uploadResponse = await fetch('/api/recipes/upload-image', {
            method: 'POST',
            body: formData
          })
          if (!uploadResponse.ok) {
            console.error('Image upload failed:', await uploadResponse.text())
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError)
        }
      }
      // Note: Candidate image URL is handled by the /api/recipes endpoint directly

      // Update toast - finalizing
      toast.loading('Finalizing...', {
        id: toastId,
        description: 'Running background tasks (summary, ingredients)'
      })

      // Small delay to allow async workflows to start
      await new Promise(resolve => setTimeout(resolve, 500))

      // Dismiss loading toast and show success
      toast.dismiss(toastId)
      
      // Show success message
      if (imageDownloadStatus === 'success') {
        toast.success('Recipe saved successfully!', {
          description: `"${savedRecipe.title}" has been added to your collection`
        })
      } else if (imageDownloadStatus === 'failed' && imageDownloadMessage) {
        toast.success('Recipe saved successfully!', {
          description: `${savedRecipe.title} saved. Note: ${imageDownloadMessage}`
        })
      } else {
        toast.success('Recipe saved successfully!', {
          description: `"${savedRecipe.title}" has been added to your collection. Background tasks are running...`
        })
      }

      // Close dialog and refresh recipe list
      onOpenChange(false)
      onRefresh()

    } catch (error) {
      console.error('Error saving recipe:', error)
      toast.dismiss(toastId)
      toast.error('Failed to save recipe', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isManualMode ? 'Create Recipe' : 'Review Recipe'}</DialogTitle>
          <DialogDescription>
            {isManualMode 
              ? 'Fill in the recipe details below and click save when you\'re done.'
              : 'Review and edit the imported recipe details before saving.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <div className="grid gap-4 pt-4">
          {/* Video Progress Tracker - shown when video is processing */}
          {isVideoProcessing && videoProgress && (
            <VideoProgressTracker 
              progress={videoProgress}
            />
          )}
          
          {/* Editable fields for title, ingredients, instructions */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Title</label>
              <input
                className="w-full p-2 border rounded"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Recipe title"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Ingredients</label>
              <textarea
                className="w-full p-2 border rounded"
                rows={4}
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                placeholder="One ingredient per line"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Instructions</label>
              <textarea
                className="w-full p-2 border rounded"
                rows={6}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Cooking instructions"
              />
            </div>
          </div>
          
          {/* Image Section */}
          {(candidateImages.length > 0 || uploadedPreview) && (
            <div className="grid gap-4">
              {/* Image Carousel Picker */}
              {candidateImages.length > 0 && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Choose an image</label>
                  <div className="flex overflow-x-auto gap-4 pb-2">
                    {candidateImages.map((img, idx) => (
                      <div
                        key={img}
                        className={`relative flex-shrink-0 w-40 h-40 rounded-lg border-2 cursor-pointer transition-all ${selectedImageIdx === idx && !uploadedImage ? 'border-blue-500' : 'border-transparent'}`}
                        onClick={() => handleImageSelect(idx)}
                        tabIndex={0}
                        aria-label={`Select image ${idx + 1}`}
                      >
                        <img src={img} alt={`Candidate ${idx + 1}`} className="object-cover w-full h-full rounded-lg" />
                        {selectedImageIdx === idx && !uploadedImage && (
                          <CheckCircle2 className="absolute top-1 left-1 w-6 h-6 text-blue-500 bg-white rounded-full shadow" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Selected Image Preview */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Selected Image Preview</label>
                <div className="w-full h-56 rounded-lg overflow-hidden border">
                  {uploadedPreview ? (
                    <img src={uploadedPreview} alt="Selected preview" className="object-cover w-full h-full" />
                  ) : candidateImages[selectedImageIdx] ? (
                    <img src={candidateImages[selectedImageIdx]} alt="Selected preview" className="object-cover w-full h-full" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No image selected</div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Upload button */}
          <div className="flex flex-col items-center gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-blue-600 hover:underline">
              <Upload className="w-5 h-5" />
              <span>Upload your own image</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUploadChange} />
            </label>
            {uploadedPreview && (
              <div className="relative w-40 h-40 mt-2">
                <img src={uploadedPreview} alt="Uploaded preview" className="object-cover w-full h-full rounded-lg border-2 border-blue-500" />
                <CheckCircle2 className="absolute top-1 left-1 w-6 h-6 text-blue-500 bg-white rounded-full shadow" />
              </div>
            )}
          </div>
          
          {/* Tag Section */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Tags</label>
            {recipe?.suggestedTags && recipe.suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="text-xs text-muted-foreground w-full">Suggested:</div>
                {recipe.suggestedTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs hover:bg-blue-100 ${tags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleAddSuggestedTag(tag)}
                    disabled={tags.includes(tag)}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
            <TagInput
              tags={tags}
              onTagsChange={setTags}
              placeholder="Add tags like 'vegan', 'quick', 'dinner'..."
              getSuggestions={async (query: string) => {
                try {
                  const response = await fetch(`/api/tags?query=${encodeURIComponent(query)}`)
                  if (response.ok) {
                    const data = await response.json()
                    return data.suggestions || []
                  }
                } catch (error) {
                  console.warn('Failed to fetch tag suggestions:', error)
                }
                return []
              }}
            />
          </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 pt-6 pb-2">
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
