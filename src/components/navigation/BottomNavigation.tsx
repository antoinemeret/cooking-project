'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AddRecipeDrawer } from '@/components/recipes/AddRecipeDrawer'
import { useAddRecipe } from '@/hooks/useAddRecipe'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImportRecipeDialog } from '@/components/recipes/ImportRecipeDialog'

// Icons from Figma
const imgRecipes = "http://localhost:3845/assets/b00b13a749c72fead8836083925fc6961fa66ea5.svg"
const imgAddRecipe = "http://localhost:3845/assets/862d83f8f85090ab730cef5fe3e410a98a807cba.svg"
const imgPlanner = "http://localhost:3845/assets/3e7e967acf0a96d77bf00c1100521dd3f6efa81e.svg"
const imgGrocery = "http://localhost:3845/assets/49c3e0f7fae9b7faf1ddd28c3c53b7d277c23fa4.svg"

interface NavItem {
  href?: string
  label: string
  icon: string
  isActive?: boolean
  isDrawer?: boolean
}

export function BottomNavigation() {
  const pathname = usePathname()
  const { 
    handleManualAdd, 
    handleLinkAdd, 
    handlePhotoAdd, 
    handleFileChange,
    handleUrlSubmit,
    photoInputRef,
    isImportDialogOpen,
    setIsImportDialogOpen,
    isManualMode,
    setIsManualMode,
    isUrlInputDialogOpen,
    setIsUrlInputDialogOpen,
    importUrl,
    setImportUrl,
    importError,
    isImporting,
    importedRecipe,
    setImportedRecipe,
    isVideoProcessing,
    videoProgress
  } = useAddRecipe()

  const navItems: NavItem[] = [
    {
      href: '/recipes',
      label: 'Recipes',
      icon: imgRecipes,
      isActive: pathname.startsWith('/recipes')
    },
    {
      label: 'Add Recipe',
      icon: imgAddRecipe,
      isDrawer: true
    },
    {
      href: '/planner',
      label: 'Planner',
      icon: imgPlanner,
      isActive: pathname.startsWith('/planner')
    },
    {
      href: '/groceries',
      label: 'Groceries',
      icon: imgGrocery,
      isActive: pathname.startsWith('/groceries')
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[lightgrey] z-50">
      <div className="flex items-center justify-between px-10 py-0 h-16">
        {navItems.map((item) => {
          if (item.isDrawer) {
            return (
              <AddRecipeDrawer
                key={item.label}
                onManualAdd={handleManualAdd}
                onLinkAdd={handleLinkAdd}
                onPhotoAdd={handlePhotoAdd}
              >
                <button
                  className={cn(
                    "relative shrink-0 size-8 flex items-center justify-center transition-colors",
                    "hover:bg-muted/50 active:bg-muted rounded-lg",
                    "opacity-60"
                  )}
                >
                  <img 
                    alt={item.label} 
                    className="block max-w-none size-full" 
                    src={item.icon} 
                  />
                </button>
              </AddRecipeDrawer>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "relative shrink-0 size-8 flex items-center justify-center transition-colors",
                "hover:bg-muted/50 active:bg-muted rounded-lg",
                item.isActive
                  ? "opacity-100"
                  : "opacity-60"
              )}
            >
              <img 
                alt={item.label} 
                className="block max-w-none size-full" 
                src={item.icon} 
              />
            </Link>
          )
        })}
      </div>
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white" />
      
      {/* Hidden file input for photo import */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/jpeg,image/png"
        className="hidden"
        disabled={isImporting}
        onChange={handleFileChange}
      />

      {/* URL Input Dialog */}
      <Dialog open={isUrlInputDialogOpen} onOpenChange={setIsUrlInputDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Recipe from URL</DialogTitle>
            <DialogDescription>
              Enter a URL to a blog post or video that contains a recipe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                id="url"
                placeholder="https://example.com/recipe"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={isImporting}
              />
              {importError && (
                <Alert variant="destructive">
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUrlInputDialogOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUrlSubmit}
              disabled={isImporting || !importUrl.trim()}
            >
              {isImporting ? "Importing..." : "Import Recipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Recipe Manually</DialogTitle>
            <DialogDescription>
              This feature is coming soon! You'll be able to create recipes manually.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
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
          // Trigger refresh after import
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
          window.dispatchEvent(new CustomEvent('recipeAdded'))
        }}
      />
    </nav>
  )
} 