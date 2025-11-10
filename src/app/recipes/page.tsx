"use client"

import { useState, useEffect, useRef, ChangeEvent } from 'react'
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

  async function fetchRecipes() {
    setLoading(true)
    const res = await fetch('/api/recipes/list')
    const data = await res.json()
    setRecipes(data.recipes)
    setLoading(false)
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

    setIsImporting(true)
    setImportStatus("Uploading...")
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

      const result = await response.json()
      if (result.success) {
        toast.success("Recipe imported successfully!")
        fetchRecipes() // Refresh the recipes list
      } else {
        throw new Error(result.error || "Import failed")
      }
    } catch (error) {
      console.error("Photo import error:", error)
      toast.error("Failed to import recipe from photo")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  // Filter recipes based on search term
  const filteredRecipes = recipes.filter((recipe: any) =>
    recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.summary.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || containerRef.current?.scrollTop !== 0) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startY.current)
    
    if (distance > 0) {
      e.preventDefault()
      setPullDistance(Math.min(distance * 0.5, 100)) // Damping effect
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