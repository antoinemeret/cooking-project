"use client"

import { useState, useEffect, useRef, ChangeEvent } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { columns, Recipe } from "./columns"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { detectVideoUrl, getPlatformDisplayName } from "@/lib/video-url-detector"
import { VideoProgressTracker, VideoProcessingProgress, VideoProcessingStage } from "@/components/recipes/VideoProgressTracker"
import { ExtractedRecipeData, VideoPlatform } from "@/types/video-import"
import { TagInput, TagSuggestion } from "@/components/ui/tag-input"
import { XIcon } from 'lucide-react'
import { CalendarPlus, CheckCircle2, Pencil, Trash2, Upload } from 'lucide-react'

type ImportedRecipe = {
  id?: number
  title: string
  rawIngredients: string[]
  instructions: string
  tags?: string[]
  // Video-specific metadata
  sourceUrl?: string
  transcription?: string
  videoMetadata?: {
    platform: VideoPlatform
    videoId?: string
    duration?: number
    extractedAt: string
  }
  suggestedTags?: string[]
  candidateImages?: string[] // Added for image picker
}

export function DataTable({ recipes, onRefresh, loading }: { recipes: Recipe[], onRefresh: () => void, loading: boolean }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importedRecipe, setImportedRecipe] = useState<ImportedRecipe | null>(null)
  const [isManualMode, setIsManualMode] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [processingRecipeId, setProcessingRecipeId] = useState<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Unified state for all import types
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState("Add new")
  const [importUrl, setImportUrl] = useState("")
  const [importError, setImportError] = useState("")

  // Video processing progress state
  const [videoProgress, setVideoProgress] = useState<VideoProcessingProgress | null>(null)
  const [isVideoProcessing, setIsVideoProcessing] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFields, setEditFields] = useState<{ title: string; rawIngredients: string; instructions: string }>({ title: '', rawIngredients: '', instructions: '' })
  const [tagUpdateError, setTagUpdateError] = useState<string | null>(null)
  const [isUpdatingTags, setIsUpdatingTags] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false)
  const [isAddingToPlanner, setIsAddingToPlanner] = useState(false)
  const [isUrlInputDialogOpen, setIsUrlInputDialogOpen] = useState(false)

  // Track planned recipes for disabling add button
  const [plannedRecipeIds, setPlannedRecipeIds] = useState<number[]>([])

  // Fetch meal plan on mount and when refreshed
  useEffect(() => {
    async function fetchMealPlan() {
      try {
        const res = await fetch('/api/planner?userId=user123')
        if (!res.ok) return
        const data = await res.json()
        const ids = (data.mealPlan?.plannedRecipes || []).map((pr: any) => pr.recipeId)
        setPlannedRecipeIds(ids)
      } catch (err) {
        // ignore
      }
    }
    fetchMealPlan()
  }, [onRefresh])

  // Remove openReviewDialog; use setImportedRecipe and setIsImportDialogOpen only after successful import

  const handlePhotoImportClick = () => {
    photoInputRef.current?.click()
  }

  const handleRecipeTagsChange = async (recipeId: number, newTags: string[]) => {
    setIsUpdatingTags(true)
    setTagUpdateError(null)
    
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: JSON.stringify(newTags) }),
      })
      
      if (response.ok) {
        // Update the local recipe state
        setSelectedRecipe(prev => prev ? { ...prev, tags: JSON.stringify(newTags) } : null)
        // Refresh the recipe list
        onRefresh()
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to update recipe tags'
        setTagUpdateError(errorMessage)
        console.error('Failed to update recipe tags:', errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error while updating tags'
      setTagUpdateError(errorMessage)
      console.error('Error updating recipe tags:', error)
    } finally {
      setIsUpdatingTags(false)
    }
  }

  // --- Robustified dialog state management for import flow ---

  // 1. Add a helper to reset all import-related state
  function resetImportState() {
    setImportedRecipe(null)
    setIsImportDialogOpen(false)
    setIsManualMode(false)
    setImportUrl('')
    setImportError('')
    setIsImporting(false)
    setVideoProgress(null)
    setIsVideoProcessing(false)
  }

  // 2. Update handleUrlImport to only open review dialog on success, and always reset state on failure
  const handleUrlImport = async () => {
    if (!importUrl) return
    setIsImporting(true)
    setImportError("")

    // Detect if this is a video URL
    const videoDetection = detectVideoUrl(importUrl)
    let success = false
    let newRecipe: ImportedRecipe | null = null
    if (videoDetection.isVideoUrl) {
      const videoRecipe = await handleVideoUrlImport(importUrl, videoDetection.platform)
      success = !!videoRecipe
      newRecipe = videoRecipe
    } else {
      // Patch: handleRegularUrlImport returns the new recipe
      const result = await handleRegularUrlImportWithReturn(importUrl)
      success = result.success
      newRecipe = result.recipe
    }
    setIsImporting(false)
    if (success && newRecipe) {
      setImportedRecipe(newRecipe)
      setIsUrlInputDialogOpen(false)
      setIsImportDialogOpen(true)
    } else {
      // On failure, reset all import state and keep dialogs closed
      resetImportState()
    }
  }

  // Add a patched version of handleRegularUrlImport that returns the new recipe
  async function handleRegularUrlImportWithReturn(url: string): Promise<{ success: boolean, recipe: ImportedRecipe | null }> {
    setImportStatus("Scraping URL...")
    let importSuccess = false
    let newRecipe: ImportedRecipe | null = null
    try {
      const res = await fetch(`/api/scrape`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (res.ok) {
        const apiResponse = await res.json()
        const { recipe, images } = apiResponse
        newRecipe = { ...recipe, candidateImages: images }
        importSuccess = true
      } else {
        setImportError("Could not import recipe from URL.")
      }
    } catch (err) {
      setImportError("An error occurred while importing from URL.")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
    return { success: importSuccess, recipe: newRecipe }
  }

  // Update handleVideoUrlImport to return the new recipe object directly
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
    
    let videoRecipe: ImportedRecipe | null = null
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
              console.log('🎬 Video import response data:', videoRecipeData)
              console.log('🖼️ Candidate images from backend:', videoRecipeData.candidateImages)
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
                candidateImages: videoRecipeData.candidateImages || [] // Add candidate images
              }
              console.log('🍽️ Final videoRecipe object:', videoRecipe)
              
              // Final success state
              setVideoProgress({
                stage: 'done',
                message: 'Recipe successfully extracted from video!',
                platform: platformName,
                timestamp: Date.now()
              })
              
              break
            }

            if (eventData.status === 'error') {
              setImportError(eventData.error || 'Video import failed')
            }
          } catch (parseError) {
            // Ignore JSON parsing errors for partial chunks
            continue
          }
        }
      }
    } catch (error) {
      console.error('Video import error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process video. Please try again.'
      
      setVideoProgress({
        stage: 'error',
        error: errorMessage,
        platform: platformName,
        timestamp: Date.now()
      })
      
      setImportError(errorMessage)
      setImportStatus('Video processing failed')
    } finally {
      setIsVideoProcessing(false)
      // Clear video processing state after a delay
      setTimeout(() => {
        setIsVideoProcessing(false)
        setVideoProgress(null)
        setImportStatus("Add new")
      }, 3000)
    }
    return videoRecipe
  }

  const handleRegularUrlImport = async (url: string) => {
    setImportStatus("Scraping URL...")
    
    let importSuccess = false
    try {
      const res = await fetch(`/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (res.ok) {
        const { recipe: newRecipe } = await res.json()
        setImportedRecipe(newRecipe)
        importSuccess = true
      } else {
        setImportError("Could not import recipe from URL.")
      }
    } catch (err) {
      setImportError("An error occurred while importing from URL.")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
    return importSuccess
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

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
        throw new Error("Upload failed with no response body.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const eventData = JSON.parse(chunk)

        if (eventData.status) {
          setImportStatus(eventData.status)
        }

        if (eventData.status === "done") {
          setImportedRecipe(eventData.data as ImportedRecipe)
          setIsImportDialogOpen(true)
          setIsManualMode(false)
          setImportStatus("Done!")
        }

        if (eventData.status === "error") {
          toast.error("Could not read recipe. Please try a clearer photo.", {
            action: {
              label: "Import Manually",
              onClick: () => {
                setImportedRecipe({ title: "", rawIngredients: [], instructions: "", tags: [] })
                setIsManualMode(true)
                setIsImportDialogOpen(true)
              },
            },
          })
        }
      }
    } catch (error) {
      toast.error("Could not read recipe. Please try a clearer photo.", {
        action: {
          label: "Import Manually",
          onClick: () => {
            setImportedRecipe({ title: "", rawIngredients: [], instructions: "", tags: [] })
            setIsManualMode(true)
            setIsImportDialogOpen(true)
          },
        },
      })
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  const handleSave = async () => {
    if (!selectedRecipe) return

    setIsSaving(true)
    setSaveError(null)
    try {
      // Prepare the data to send
      const updateData = {
        title: editFields.title,
        rawIngredients: editFields.rawIngredients.split('\n').filter(line => line.trim()),
        instructions: editFields.instructions
      }

      // Call the API to update the recipe
      const response = await fetch(`/api/recipes/${selectedRecipe.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to save recipe'
        throw new Error(errorMessage)
      }

      const { recipe: updatedRecipe } = await response.json()

      // Optimistically update the selected recipe
      setSelectedRecipe(updatedRecipe)

      // Exit edit mode
      setIsEditMode(false)

      // Refresh the recipes list to show updated data
      onRefresh()

      // Show success feedback
      toast.success('Changes saved')

    } catch (error) {
      console.error('Error saving recipe:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save recipe. Please try again.'
      setSaveError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const checkForUnsavedChanges = () => {
    if (!selectedRecipe) return false
    
    const originalTitle = selectedRecipe.title
    const originalIngredients = selectedRecipe.rawIngredients ? JSON.parse(selectedRecipe.rawIngredients).join('\n') : ''
    const originalInstructions = selectedRecipe.instructions || ''
    
    return editFields.title !== originalTitle ||
           editFields.rawIngredients !== originalIngredients ||
           editFields.instructions !== originalInstructions
  }



  const handleExitEditMode = () => {
    const hasChanges = checkForUnsavedChanges()
    if (hasChanges) {
      setIsUnsavedChangesDialogOpen(true)
    } else {
      setIsEditMode(false)
      setEditFields({ title: '', rawIngredients: '', instructions: '' })
    }
  }

  const handleDelete = async () => {
    if (!selectedRecipe) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/recipes/${selectedRecipe.id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to delete recipe'
        throw new Error(errorMessage)
      }
      setIsDeleteDialogOpen(false)
      setSelectedRecipe(null)
      onRefresh()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe'
      setDeleteError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const table = useReactTable({
    data: recipes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter: searchTerm,
      pagination: {
        pageSize: 50,
        pageIndex: 0,
      },
    },
    onGlobalFilterChange: setSearchTerm,
  })

  useEffect(() => {
    if (isEditMode && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditMode])

  // Debug log for Input component used in sheet edit mode
  // 1. In DataTable, log importedRecipe before rendering ImportRecipeDialog
  // Render the Import from URL dialog
  const renderUrlInputDialog = () => (
    <Dialog open={isUrlInputDialogOpen} onOpenChange={setIsUrlInputDialogOpen}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Import Recipe from URL or Video</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <Input
            type="text"
            placeholder="Paste recipe URL or video link..."
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            disabled={isImporting}
            className="w-full"
          />
        </div>
        {importError && <div className="text-sm text-destructive mb-2">{importError}</div>}
        <DialogFooter>
          <Button onClick={handleUrlImport} disabled={isImporting || !importUrl} className="w-full">
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  // 3. Update handleReviewDialogClose to always reset all import state
  function handleReviewDialogClose() {
    resetImportState()
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Search recipes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {/* 1. In DataTable, log importedRecipe before rendering ImportRecipeDialog */}
          {/* Render the Import from URL dialog */}
          <ImportRecipeDialog
            open={isImportDialogOpen}
            onOpenChange={handleReviewDialogClose}
            recipe={importedRecipe}
            setRecipe={setImportedRecipe}
            isManualMode={isManualMode}
            setIsManualMode={setIsManualMode}
            onImport={handleUrlImport}
            setProcessingRecipeId={setProcessingRecipeId}
            url={importUrl}
            setUrl={setImportUrl}
            onUrlImport={handleUrlImport}
            loading={isImporting}
            error={importError}
            videoProgress={videoProgress}
            isVideoProcessing={isVideoProcessing}
            onRefresh={onRefresh}
          />
          
          {/* Compact Video Progress Tracker - shown when dialog is closed and video is processing */}
          {isVideoProcessing && videoProgress && !isImportDialogOpen && (
            <div className="flex-1 max-w-md">
              <VideoProgressTracker 
                progress={videoProgress}
              />
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isImporting}>
                {isImporting ? importStatus : "Add new"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => {
                  setImportedRecipe({ title: "", rawIngredients: [], instructions: "", tags: [] })
                  setIsManualMode(true)
                  setIsImportDialogOpen(true)
                }}
              >
                Create manually
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setIsUrlInputDialogOpen(true)
                  // Do NOT open the review dialog or reset importedRecipe here
                }}
              >
                Import from URL or Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePhotoImportClick}>
                Import from Photo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="file"
            ref={photoInputRef}
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileChange}
            disabled={isImporting}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-2">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={() => column.toggleVisibility()}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'title') {
                  return (
                    <TableCell key={cell.id}>
                      <button
                        className='text-blue-600 hover:underline'
                        onClick={() => setSelectedRecipe(row.original)}
                      >
                        {row.original.title}
                      </button>
                    </TableCell>
                  )
                }
                // Show loader in the first cell if this row is being processed
                if (row.original.id === processingRecipeId && cell.column.id === 'title') {
                  return (
                    <TableCell key={cell.id}>
                      <div className="flex items-center gap-2">
                        <span>{row.original.title}</span>
                        <span className="ml-2 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500" />
                      </div>
                    </TableCell>
                  )
                }
                return (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button
          variant="outline"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
      {/* Render a single Sheet for the selected recipe */}
      {selectedRecipe && (
        <Sheet open={selectedRecipe !== null} onOpenChange={(open) => {
          if (!open) {
            // Check for unsaved changes before closing
            if (isEditMode && checkForUnsavedChanges()) {
              setIsUnsavedChangesDialogOpen(true)
            } else {
              setSelectedRecipe(null)
              setIsEditMode(false)
              setEditFields({ title: '', rawIngredients: '', instructions: '' })
            }
          }
        }}>
          <SheetContent className="w-full sm:w-full md:w-2/3 md:min-w-[500px] p-6 flex flex-col gap-6" showCloseButton={!isEditMode}>
            <SheetTitle className="sr-only">{selectedRecipe?.title || 'Recipe Details'}</SheetTitle>
            {!isEditMode && (
              <div className="text-2xl font-bold mt-2 mb-4">{selectedRecipe?.title}</div>
            )}
            {/* Sticky close button in edit mode */}
            {isEditMode && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close Edit Mode"
                onClick={handleExitEditMode}
                className="absolute top-4 right-4 z-50"
              >
                <XIcon className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 ml-auto">
                {!isEditMode && (
                  plannedRecipeIds.includes(selectedRecipe.id)
                    ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="In planner"
                          disabled
                          className="flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          In planner
                        </Button>
                      )
                    : (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Add to planner"
                          onClick={async () => {
                            if (!selectedRecipe) return
                            setIsAddingToPlanner(true)
                            try {
                              const response = await fetch('/api/planner', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recipeId: selectedRecipe.id, userId: 'user123' })
                              })
                              if (response.ok) {
                                toast(
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span>Recipe added to planner!</span>
                                  </div>
                                )
                                // Optimistically update plannedRecipeIds
                                setPlannedRecipeIds(ids => [...ids, selectedRecipe.id])
                              } else {
                                const data = await response.json().catch(() => ({}))
                                toast.error(data.error || 'Failed to add recipe to planner')
                              }
                            } catch (err) {
                              toast.error('Failed to add recipe to planner')
                            } finally {
                              setIsAddingToPlanner(false)
                            }
                          }}
                          disabled={isEditMode || isAddingToPlanner}
                          className="flex items-center gap-1"
                        >
                          <CalendarPlus className="w-5 h-5" />
                          {isAddingToPlanner ? 'Adding...' : 'Add to planner'}
                        </Button>
                      )
                )}
                {!isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Edit Recipe"
                    onClick={() => {
                      setIsEditMode(true)
                      setSaveError(null)
                      setHasUnsavedChanges(false)
                      setEditFields({
                        title: selectedRecipe?.title || '',
                        rawIngredients: selectedRecipe?.rawIngredients ? JSON.parse(selectedRecipe.rawIngredients).join('\n') : '',
                        instructions: selectedRecipe?.instructions || ''
                      })
                    }}
                    disabled={isEditMode}
                    className="flex items-center gap-1"
                  >
                    <Pencil className="w-5 h-5" />
                    Edit
                  </Button>
                )}
                {!isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Delete Recipe"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isEditMode}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {isEditMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <Input
                      ref={titleInputRef}
                      value={editFields.title}
                      onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))}
                      placeholder="Enter recipe title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ingredients</label>
                    <textarea
                      className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={5}
                      value={editFields.rawIngredients}
                      onChange={e => setEditFields(f => ({ ...f, rawIngredients: e.target.value }))}
                      placeholder="Enter ingredients, one per line"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter each ingredient on a new line</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Instructions</label>
                    <textarea
                      className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={8}
                      value={editFields.instructions}
                      onChange={e => setEditFields(f => ({ ...f, instructions: e.target.value }))}
                      placeholder="Enter cooking instructions"
                    />
                  </div>
                  {/* Error Alert */}
                  {saveError && (
                    <Alert variant="destructive">
                      <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                  )}
                  {/* Footer with full-width Save button */}
                  <div className="mt-6 flex justify-end border-t pt-4">
                    <Button 
                      variant="default" 
                      className="w-full" 
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Ingredients</h2>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                      {selectedRecipe?.rawIngredients && JSON.parse(selectedRecipe.rawIngredients).map((ingredient: string) => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                    <p className="whitespace-pre-line">{selectedRecipe?.instructions}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Tags</h2>
                    <RecipeTagEditor 
                      recipe={selectedRecipe} 
                      onTagsChange={handleRecipeTagsChange}
                      isUpdating={isUpdatingTags}
                      error={tagUpdateError}
                    />
                  </div>
                </>
              )}
            </div>
          </SheetContent>
          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Recipe</DialogTitle>
              </DialogHeader>
              <div className="py-2">Are you sure you want to delete this recipe? This action cannot be undone.</div>
              {deleteError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Unsaved Changes Dialog */}
          <Dialog open={isUnsavedChangesDialogOpen} onOpenChange={setIsUnsavedChangesDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unsaved Changes</DialogTitle>
              </DialogHeader>
              <div className="py-2">You have unsaved changes. Are you sure you want to discard them?</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUnsavedChangesDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => {
                  setIsEditMode(false)
                  setSelectedRecipe(null)
                  setEditFields({ title: '', rawIngredients: '', instructions: '' })
                  setIsUnsavedChangesDialogOpen(false)
                }}>
                  Discard Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Sheet>
      )}
      {/* URL Input Dialog */}
      {renderUrlInputDialog()}
    </div>
  )
}

type RecipeTagEditorProps = {
  recipe: Recipe | null
  onTagsChange: (recipeId: number, tags: string[]) => void
  isUpdating?: boolean
  error?: string | null
}

function RecipeTagEditor({ recipe, onTagsChange, isUpdating = false, error }: RecipeTagEditorProps) {
  if (!recipe) return null

  const currentTags = recipe.tags ? JSON.parse(recipe.tags) : []

  return (
    <div className="space-y-2">
      <TagInput
        tags={currentTags}
        onTagsChange={(newTags) => onTagsChange(recipe.id, newTags)}
        placeholder="Add tags like 'vegan', 'quick', 'dinner'..."
        disabled={isUpdating}
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
      {isUpdating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
          <span>Saving tags...</span>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
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
  // Video processing props
  videoProgress: VideoProcessingProgress | null
  isVideoProcessing: boolean
  // Add onRefresh prop
  onRefresh: () => void
}

function ImportRecipeDialog({
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

  async function handleValidate() {
    if (!recipe) return

    try {
      // Prepare recipe data with tags and video metadata
      const userTags = recipe.tags || []
      // Add more fields here if needed
      const videoTags = recipe.sourceUrl && recipe.videoMetadata ? [
        `source:video:${recipe.videoMetadata.platform}`,
        `extracted:${recipe.videoMetadata.extractedAt}`
      ] : [];
    } catch (err) {
      // error handling
    }
  }

  // Add suggested tag handler
  function handleAddSuggestedTag(tag: string) {
    if (!tags.includes(tag)) setTags([...tags, tag])
  }

  // Define handleSave with backend call
  async function handleSave() {
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) {
      alert('Please fill in all fields')
      return
    }

    try {
      // Prepare recipe data for backend
      const recipeData = {
        title: title.trim(),
        rawIngredients: ingredients.split('\n').map(line => line.trim()).filter(Boolean),
        instructions: instructions.trim(),
        tags: JSON.stringify(tags),
        // Include selected image URL if user selected a candidate image
        selectedImageUrl: candidateImages[selectedImageIdx] || null
      }

      // Call existing backend endpoint
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save recipe')
      }

      const responseData = await response.json()
      const { recipe: savedRecipe, imageDownloadStatus, imageDownloadMessage } = responseData

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

      // Show user-friendly message about image download status
      if (imageDownloadStatus === 'success') {
        console.log('✅ Image downloaded successfully')
      } else if (imageDownloadStatus === 'failed' && imageDownloadMessage) {
        // Show a non-blocking notification about image download failure
        setTimeout(() => {
          alert(`Recipe saved successfully!\n\n⚠️ ${imageDownloadMessage}`)
        }, 100)
      }

      // Close dialog and refresh recipe list
      onOpenChange(false)
      onRefresh()

    } catch (error) {
      console.error('Error saving recipe:', error)
      alert(`Failed to save recipe: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
// RETURN your dialog JSX here!
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md w-full">
      <DialogHeader>
        <DialogTitle>{isManualMode ? 'Create Recipe' : 'Review Recipe'}</DialogTitle>
      </DialogHeader>
      {/* Editable fields for title, ingredients, instructions */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          className="w-full p-2 border rounded mb-2"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Recipe title"
        />
        <label className="block text-sm font-medium mb-1">Ingredients</label>
        <textarea
          className="w-full p-2 border rounded mb-2"
          rows={4}
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
          placeholder="One ingredient per line"
        />
        <label className="block text-sm font-medium mb-1">Instructions</label>
        <textarea
          className="w-full p-2 border rounded"
          rows={6}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Cooking instructions"
        />
      </div>
      {/* --- Image Section: everything below instructions --- */}
      <div className="mb-4">
        {/* Image Carousel Picker */}
        {candidateImages.length > 0 && (
          <div className="flex overflow-x-auto gap-4 pb-2 mb-2">
            {candidateImages.map((img, idx) => (
              <div
                key={img}
                className={`relative flex-shrink-0 w-32 h-32 rounded-lg border-2 cursor-pointer transition-all ${selectedImageIdx === idx && !uploadedImage ? 'border-blue-500' : 'border-transparent'}`}
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
        )}
        {/* Selected Image Preview */}
        <div className="mb-2">
          <div className="text-sm font-medium mb-1">Selected Image Preview</div>
          <div className="w-full h-40 rounded-lg overflow-hidden border">
            {uploadedPreview ? (
              <img src={uploadedPreview} alt="Selected preview" className="object-cover w-full h-full" />
            ) : candidateImages[selectedImageIdx] ? (
              <img src={candidateImages[selectedImageIdx]} alt="Selected preview" className="object-cover w-full h-full" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No image selected</div>
            )}
          </div>
        </div>
        {/* Upload button below preview */}
        <div className="mt-2 flex flex-col items-center gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-blue-600 hover:underline">
            <Upload className="w-5 h-5" />
            <span>Upload your own image</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUploadChange} />
          </label>
          {uploadedPreview && (
            <div className="relative w-32 h-32 mt-2">
              <img src={uploadedPreview} alt="Uploaded preview" className="object-cover w-full h-full rounded-lg border-2 border-blue-500" />
              <CheckCircle2 className="absolute top-1 left-1 w-6 h-6 text-blue-500 bg-white rounded-full shadow" />
            </div>
          )}
        </div>
      </div>
      {/* --- Tag Section: below image section --- */}
      <div className="mb-4">
        {recipe?.suggestedTags && recipe.suggestedTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
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
      {/* Save button */}
      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} className="w-full">Save</Button>
      </div>
    </DialogContent>
  </Dialog>
)
}