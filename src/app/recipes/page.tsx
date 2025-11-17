"use client"

import { useState, useEffect, useRef, ChangeEvent, useMemo } from 'react'
import { RecipeCard } from '@/components/recipes/RecipeCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImportRecipeDialog } from '@/components/recipes/ImportRecipeDialog'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Add recipe functionality
  const [isAddRecipeOptionsDialogOpen, setIsAddRecipeOptionsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [isUrlInputDialogOpen, setIsUrlInputDialogOpen] = useState(false)
  const [importUrl, setImportUrl] = useState("")
  const [importError, setImportError] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState("Add new")
  const [importedRecipe, setImportedRecipe] = useState<any>(null)
  const [isVideoProcessing, setIsVideoProcessing] = useState(false)
  const [videoProgress, setVideoProgress] = useState<any>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoImportToastIdRef = useRef<string | number | undefined>(undefined)

  async function fetchRecipes() {
    setLoading(true)
    try {
      const res = await fetch('/api/recipes/list')
      if (!res.ok) {
        console.error('Failed to fetch recipes:', res.status, res.statusText)
        toast.error('Failed to load recipes')
        setLoading(false)
        return
      }
      const data = await res.json()
      console.log('Fetched recipes:', data.recipes?.length || 0, 'recipes')
      console.log('Recipe IDs:', data.recipes?.map((r: any) => r.id) || [])
      if (data.recipes && Array.isArray(data.recipes)) {
        setRecipes(data.recipes)
      } else {
        console.error('Invalid recipes data:', data)
        toast.error('Invalid recipe data received')
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
      toast.error('Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  function handleRefresh() {
    setRefreshing(true)
    fetchRecipes().finally(() => setRefreshing(false))
  }

  const handleAddToPlanner = async (recipeId: number) => {
    try {
      const response = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, userId: 'user123' })
      })

      if (response.ok) {
        toast.success('Recipe added to planner!')
      } else {
        const data = await response.json().catch(() => ({}))
        if (response.status === 409) {
          toast.info('Recipe already in planner')
        } else {
          toast.error(data.error || 'Failed to add recipe to planner')
        }
      }
    } catch (error) {
      console.error('Add to planner error:', error)
      toast.error('Failed to add recipe to planner')
    }
  }

  const handleMoreActions = async (recipeId: number, action: string) => {
    switch (action) {
      case 'edit':
        // Edit functionality is now handled in RecipeSheet component
        break
      case 'favorite':
        // TODO: Implement add to favorites functionality
        toast.info('Add to favorites functionality coming soon')
        break
      case 'delete':
        // Delete functionality is now handled in RecipeSheet component
        // This case is called after successful deletion to refresh the list
        toast.success('Recipe deleted successfully')
        fetchRecipes() // Refresh the list
        break
      case 'refresh':
        // Refresh the recipe list after edit
        fetchRecipes()
        break
      default:
        break
    }
  }

  // Add recipe handlers
  const handleManualAdd = () => {
    setIsAddRecipeOptionsDialogOpen(false)
    setImportedRecipe({ title: "", rawIngredients: [], instructions: "", tags: [] })
    setIsManualMode(true)
    setIsImportDialogOpen(true)
  }

  const handleLinkAdd = () => {
    setIsAddRecipeOptionsDialogOpen(false)
    setIsUrlInputDialogOpen(true)
  }

  const handlePhotoAdd = () => {
    setIsAddRecipeOptionsDialogOpen(false)
    photoInputRef.current?.click()
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
      
      if (result.recipe) {
        setImportedRecipe({
          title: result.recipe.title,
          rawIngredients: result.recipe.rawIngredients || [],
          instructions: result.recipe.instructions || '',
          tags: result.recipe.suggestedTags || [],
          candidateImages: result.images || []
        })
        setIsUrlInputDialogOpen(false)
        setIsManualMode(false)
        setIsImportDialogOpen(true)
        setImportUrl("")
      } else {
        throw new Error(result.error || "No recipe data received")
      }
    } catch (error: any) {
      console.error("URL import error:", error)
      setImportError(error.message || "Failed to import recipe from URL")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Prevent multiple uploads
    if (isImporting) {
      toast.warning("Photo import already in progress. Please wait...")
      return
    }

    // Prevent multiple uploads
    setIsImporting(true)
    setImportStatus("Uploading...")
    
    // Show initial loading toast immediately
    const toastId = toast.loading("Uploading photo...", {
      description: "Preparing your image for processing",
      duration: Infinity // Keep it visible until we dismiss it
    })
    
    photoImportToastIdRef.current = toastId
    console.log('📸 Photo import started, toast ID:', toastId)
    
    // Wait for next tick to ensure toast is rendered
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

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
              
              console.log('📸 Status update:', eventData.status)
              
              // Update toast with progress - ensure toastId is defined
              const currentToastId = photoImportToastIdRef.current
              if (currentToastId) {
                if (eventData.status === 'Analyzing recipe image...') {
                  toast.loading("Analyzing recipe image...", {
                    id: currentToastId,
                    description: "Using AI to extract recipe information from your photo",
                    duration: Infinity
                  })
                } else if (eventData.status === 'Processing extracted data...') {
                  toast.loading("Processing extracted data...", {
                    id: currentToastId,
                    description: "Structuring the recipe information",
                    duration: Infinity
                  })
                } else if (eventData.status === 'Repairing data format...') {
                  toast.loading("Repairing data format...", {
                    id: currentToastId,
                    description: "Fixing any formatting issues",
                    duration: Infinity
                  })
                } else if (eventData.status && eventData.status !== 'done' && eventData.status !== 'error') {
                  // Update toast for any other status messages
                  toast.loading(eventData.status, {
                    id: currentToastId,
                    description: "Processing your photo...",
                    duration: Infinity
                  })
                }
              }
            }

            if (eventData.status === 'done' && eventData.data) {
              const photoRecipeData = eventData.data
              
              // Dismiss loading toast if it exists
              const currentToastId = photoImportToastIdRef.current
              if (currentToastId) {
                toast.dismiss(currentToastId)
                photoImportToastIdRef.current = undefined
              }
              
              // Create the recipe object for the review dialog
              const photoRecipe = {
                title: photoRecipeData.title,
                rawIngredients: photoRecipeData.rawIngredients || [],
                instructions: photoRecipeData.instructions || '',
                suggestedTags: photoRecipeData.suggestedTags || [],
                candidateImages: []
              }
              
              // Open the review dialog instead of directly saving
              setImportedRecipe(photoRecipe)
              setIsImportDialogOpen(true)
              setIsManualMode(false)
              
              // Small delay before showing success to ensure loading toast is dismissed
              setTimeout(() => {
                toast.success("Recipe extracted successfully!", {
                  description: "Review and edit the details before saving"
                })
              }, 100)
            }

            if (eventData.status === 'error') {
              const currentToastId = photoImportToastIdRef.current
              if (currentToastId) {
                toast.dismiss(currentToastId)
                photoImportToastIdRef.current = undefined
              }
              throw new Error(eventData.error || 'Photo processing failed')
            }
          } catch (parseError) {
            console.error('Error parsing photo import event:', parseError)
            console.error('Problematic line:', line)
          }
        }
      }
    } catch (error) {
      console.error("Photo import error:", error)
      // Dismiss loading toast if it exists
      if (photoImportToastIdRef.current) {
        toast.dismiss(photoImportToastIdRef.current)
        photoImportToastIdRef.current = undefined
      }
      toast.error("Failed to import recipe from photo", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      })
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
      // Reset file input
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  // Filter recipes based on search term
  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return recipes
    const searchLower = searchTerm.toLowerCase()
    return recipes.filter((recipe: any) => {
      const titleMatch = recipe.title?.toLowerCase().includes(searchLower) || false
      const summaryMatch = recipe.summary?.toLowerCase().includes(searchLower) || false
      return titleMatch || summaryMatch
    })
  }, [recipes, searchTerm])

  // Debug logging
  useEffect(() => {
    if (recipes.length > 0) {
      console.log('Recipes state:', recipes.length, 'recipes')
      console.log('Filtered recipes:', filteredRecipes.length, 'recipes')
      console.log('All recipe IDs in state:', recipes.map((r: any) => r.id))
      console.log('Filtered recipe IDs:', filteredRecipes.map((r: any) => r.id))
      if (recipes.length !== filteredRecipes.length) {
        const missingIds = recipes
          .filter((r: any) => !filteredRecipes.find((fr: any) => fr.id === r.id))
          .map((r: any) => r.id)
        console.warn('Recipes filtered out:', missingIds)
      }
    }
  }, [recipes, filteredRecipes, searchTerm])

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only activate pull-to-refresh if we're at the very top of the page
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    } else {
      setIsPulling(false)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't interfere with normal scrolling
    if (!isPulling) return
    
    // Double-check we're still at the top
    if (containerRef.current?.scrollTop !== 0) {
      setIsPulling(false)
      setPullDistance(0)
      return
    }
    
    const currentY = e.touches[0].clientY
    const distance = currentY - startY.current
    
    // Only prevent default and show pull indicator if pulling DOWN (positive distance)
    // If distance is negative, user is scrolling up, so don't interfere
    if (distance > 0) {
      e.preventDefault()
      setPullDistance(Math.min(distance * 0.5, 100)) // Damping effect
    } else {
      // User is scrolling up, cancel pull-to-refresh
      setIsPulling(false)
      setPullDistance(0)
    }
  }

  const handleTouchEnd = () => {
    if (isPulling && pullDistance > 60) {
      handleRefresh()
    }
    setIsPulling(false)
    setPullDistance(0)
  }

  useEffect(() => {
    fetchRecipes()
  }, [])

  // Listen for recipe added event from navigation
  useEffect(() => {
    const handleRecipeAdded = () => {
      fetchRecipes()
    }

    window.addEventListener('recipeAdded', handleRecipeAdded)
    return () => window.removeEventListener('recipeAdded', handleRecipeAdded)
  }, [])

  return (
    <div 
      ref={containerRef}
      className="container mx-auto p-3 sm:p-4 max-w-full h-full overflow-auto pb-20 lg:pb-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Pull to refresh indicator */}
      {(isPulling || refreshing) && (
        <div 
          className="flex items-center justify-center py-4 text-sm text-muted-foreground"
          style={{
            transform: `translateY(-${Math.max(0, 60 - pullDistance)}px)`,
            opacity: Math.min(1, pullDistance / 60)
          }}
        >
          {refreshing ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Refreshing...</span>
            </div>
          ) : pullDistance > 60 ? (
            <span>Release to refresh</span>
          ) : (
            <span>Pull to refresh</span>
          )}
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Recipes</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 hidden sm:flex" disabled={isImporting}>
              {isImporting ? importStatus : 'Add Recipe'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onSelect={() => {
                setImportedRecipe({ title: '', rawIngredients: [], instructions: '', tags: [] })
                setIsManualMode(true)
                setIsImportDialogOpen(true)
              }}
            >
              Create manually
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setIsUrlInputDialogOpen(true)
              }}
            >
              Import from URL or Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
              Import from Photo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
          <span>Loading recipes...</span>
        </div>
      )}

      {/* Recipe Cards */}
      {!loading && (
        <div className="space-y-4">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                {searchTerm ? 'No recipes found matching your search.' : 'No recipes yet.'}
              </div>
              {!searchTerm && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first recipe
                </Button>
              )}
            </div>
          ) : (
            filteredRecipes.map((recipe: any) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onAddToPlanner={handleAddToPlanner}
                onMoreActions={handleMoreActions}
              />
            ))
          )}
        </div>
      )}

      {/* Hidden file input for photo import */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
        disabled={isImporting}
      />

      {/* Desktop uses dropdown menu in header; no separate options dialog */}

      {/* URL Input Dialog */}
      <Dialog open={isUrlInputDialogOpen} onOpenChange={setIsUrlInputDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Recipe from URL or Video</DialogTitle>
            <DialogDescription>
              Paste a recipe URL or video link to automatically extract the recipe content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              type="text"
              placeholder="Paste recipe URL or video link..."
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              disabled={isImporting}
            />
            
            {importError && (
              <Alert variant="destructive">
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            
            <Button onClick={handleUrlSubmit} disabled={isImporting || !importUrl} className="w-full">
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Recipe Dialog */}
      <ImportRecipeDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        recipe={importedRecipe}
        setRecipe={setImportedRecipe}
        isManualMode={isManualMode}
        setIsManualMode={setIsManualMode}
        onImport={() => {
          fetchRecipes()
          window.dispatchEvent(new CustomEvent('recipeAdded'))
        }}
        setProcessingRecipeId={() => {}}
        url={importUrl}
        setUrl={setImportUrl}
        onUrlImport={handleUrlSubmit}
        loading={isImporting}
        error={importError}
        videoProgress={videoProgress}
        isVideoProcessing={isVideoProcessing}
        onRefresh={() => {
          fetchRecipes()
          window.dispatchEvent(new CustomEvent('recipeAdded'))
        }}
      />
    </div>
  )
}