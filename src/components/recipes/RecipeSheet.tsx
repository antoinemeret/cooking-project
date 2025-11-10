'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ChevronLeft, SquarePen, Heart, Trash2, CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'

interface Recipe {
  id: number
  title: string
  summary?: string
  image?: string | null
  preparationTime?: number | null
  cookingTime?: number | null
  ingredients?: string[]
  instructions?: string
}

interface RecipeSheetProps {
  recipe: Recipe
  isOpen: boolean
  onClose: () => void
  onAddToPlanner: (recipeId: number) => void
  onMoreActions: (recipeId: number, action: string) => void
  initialAction?: string
}

export function RecipeSheet({
  recipe,
  isOpen,
  onClose,
  onAddToPlanner,
  onMoreActions,
  initialAction
}: RecipeSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [showEditContent, setShowEditContent] = useState(false)
  const [editFields, setEditFields] = useState({
    title: recipe.title,
    rawIngredients: recipe.ingredients?.join('\n') || '',
    instructions: recipe.instructions || ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Scroll to top when sheet opens - use useLayoutEffect for synchronous execution
  useLayoutEffect(() => {
    if (isOpen) {
      console.log('Sheet opened, current scroll position:', window.scrollY, document.documentElement.scrollTop)
      
      // Force scroll to top immediately
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
      document.documentElement.scrollTop = 0
      
      if (sheetRef.current) {
        sheetRef.current.scrollTop = 0
      }
      
      console.log('After scroll reset, position:', window.scrollY, document.documentElement.scrollTop)
    }
  }, [isOpen])

  // Trigger initial action when sheet opens
  useEffect(() => {
    if (isOpen && initialAction) {
      handleAction(initialAction)
    }
  }, [isOpen, initialAction])

  // Reset scroll when entering edit mode - use useLayoutEffect for synchronous execution
  useLayoutEffect(() => {
    if (isEditMode) {
      console.log('Edit mode activated, current scroll position:', window.scrollY, document.documentElement.scrollTop)
      
      // Force scroll to top when entering edit mode
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
      document.documentElement.scrollTop = 0
      
      if (sheetRef.current) {
        sheetRef.current.scrollTop = 0
      }
      
      // Hide edit content initially to prevent layout shift
      setShowEditContent(false)
      
      // Show edit content after scroll is locked
      setTimeout(() => {
        console.log('Showing edit content, scroll position:', window.scrollY, document.documentElement.scrollTop)
        setShowEditContent(true)
      }, 100)
      
      // Check scroll position after content is shown
      setTimeout(() => {
        console.log('After content shown, scroll position:', window.scrollY, document.documentElement.scrollTop)
        if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
          console.log('Scroll position changed, resetting to top')
          window.scrollTo(0, 0)
          document.body.scrollTop = 0
          document.documentElement.scrollTop = 0
          if (sheetRef.current) {
            sheetRef.current.scrollTop = 0
          }
        }
      }, 200)
      
    } else {
      setShowEditContent(false)
    }
  }, [isEditMode])

  // Add a scroll event listener to detect when scroll changes
  useEffect(() => {
    const handleScroll = () => {
      if (isEditMode && isOpen && (window.scrollY > 0 || document.documentElement.scrollTop > 0)) {
        console.log('Scroll detected in edit mode, resetting to top')
        window.scrollTo(0, 0)
        document.body.scrollTop = 0
        document.documentElement.scrollTop = 0
        if (sheetRef.current) {
          sheetRef.current.scrollTop = 0
        }
      }
    }

    if (isEditMode && isOpen) {
      window.addEventListener('scroll', handleScroll, { passive: false })
      document.addEventListener('scroll', handleScroll, { passive: false })
      if (sheetRef.current) {
        sheetRef.current.addEventListener('scroll', handleScroll, { passive: false })
      }
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('scroll', handleScroll)
      if (sheetRef.current) {
        sheetRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [isEditMode, isOpen])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
      editFields.title !== recipe.title ||
      editFields.rawIngredients !== (recipe.ingredients?.join('\n') || '') ||
      editFields.instructions !== (recipe.instructions || '')
    setHasUnsavedChanges(hasChanges)
  }, [editFields, recipe])

  // Cleanup scroll lock when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
    }
  }, [])

  if (!isOpen) return null

  const handleAction = (action: string) => {
    if (action === 'edit') {
      setIsEditMode(true)
    } else if (action === 'delete') {
      setIsDeleteDialogOpen(true)
    } else {
      onMoreActions(recipe.id, action)
    }
  }

  const handleAddToPlanner = () => {
    onAddToPlanner(recipe.id)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editFields.title,
          rawIngredients: editFields.rawIngredients.split('\n').filter(line => line.trim()),
          instructions: editFields.instructions
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save recipe')
      }

      toast.success('Changes saved')
      setIsEditMode(false)
      setHasUnsavedChanges(false)
      
      // Refresh the recipe data by calling onMoreActions with a refresh action
      onMoreActions(recipe.id, 'refresh')
    } catch (error) {
      console.error('Save error:', error)
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        setIsEditMode(false)
        setEditFields({
          title: recipe.title,
          rawIngredients: recipe.ingredients?.join('\n') || '',
          instructions: recipe.instructions || ''
        })
        setHasUnsavedChanges(false)
      }
    } else {
      setIsEditMode(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to delete recipe'
        throw new Error(errorMessage)
      }

      setIsDeleteDialogOpen(false)
      onClose() // Close the sheet
      onMoreActions(recipe.id, 'delete') // This will refresh the list
    } catch (error) {
      console.error('Delete error:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete recipe')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Recipe sheet */}
      <div ref={sheetRef} className="absolute bottom-0 left-0 right-0 h-full bg-white overflow-y-auto" style={{ scrollBehavior: 'auto' }}>
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className={`relative ${recipe.image ? 'h-[312px]' : 'h-[220px]'}`}>
            {/* Recipe image */}
            <div className="absolute bg-white h-[220px] left-0 top-0 w-full overflow-hidden">
              {recipe.image && (
                <div 
                  className="absolute bg-center bg-cover bg-no-repeat left-1/2 size-full translate-x-[-50%] translate-y-[-50%]"
                  style={{ 
                    top: "calc(50% - 0.5px)", 
                    backgroundImage: `url('${recipe.image}')` 
                  }} 
                />
              )}
              <div className="absolute inset-0 pointer-events-none shadow-[0px_60px_30px_-25px_inset_rgba(0,0,0,0.5)]" />
            </div>
            
            {/* Back button */}
            <button
              onClick={onClose}
              className="absolute left-5 size-6 top-2.5 z-10 flex items-center justify-center"
            >
              <ChevronLeft className="size-6 text-white" />
            </button>
            
            {/* Recipe title card */}
            <div className={`absolute bg-[#f3f3f3] box-border flex flex-col gap-2 items-center justify-start left-5 right-5 px-4 py-5 rounded-[8px] ${recipe.image ? 'top-[168px]' : 'bottom-0'}`}>
              <div className="font-bold leading-[0] relative shrink-0 text-[#212b36] text-[22px] w-full">
                <p className="leading-[32px]">{recipe.title}</p>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between relative shrink-0 w-full">
                <div className="flex gap-4 items-start justify-start relative shrink-0">
                  {isEditMode ? (
                    <button
                      onClick={handleCancel}
                      className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[#212b36] text-lg font-bold">×</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('edit')}
                      className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity flex items-center justify-center"
                    >
                      <SquarePen className="size-[22px] text-[#212b36]" />
                    </button>
                  )}
                  {!isEditMode && (
                    <>
                      <button
                        onClick={() => handleAction('favorite')}
                        className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity flex items-center justify-center"
                      >
                        <Heart className="size-[22px] text-[#212b36]" />
                      </button>
                      <button
                        onClick={() => handleAction('delete')}
                        className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="size-[22px] text-[#212b36]" />
                      </button>
                    </>
                  )}
                </div>
                {!isEditMode && (
                  <button
                    onClick={handleAddToPlanner}
                    className="bg-neutral-700 overflow-hidden relative rounded-[18px] shrink-0 size-8 hover:opacity-80 transition-opacity flex items-center justify-center"
                  >
                    <CalendarPlus className="size-[18px] text-white" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Recipe content */}
          <div className="flex flex-col font-bold gap-5 items-start justify-start px-5 py-0 relative shrink-0 text-neutral-700 w-full">
            {isEditMode ? (
              <>
                {/* Edit Mode Fields - Only show after delay to prevent layout shift */}
                {showEditContent ? (
                  <div className="w-full space-y-4">
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
                    {saveError && (
                      <Alert variant="destructive">
                        <AlertDescription>{saveError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-48 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* View Mode */}
                {/* Ingredients */}
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="min-w-full relative shrink-0">
                    <p className="font-semibold leading-[32px] mb-4 text-[20px] text-neutral-700">Ingrédients</p>
                    <ul className="list-disc pl-4 space-y-2">
                      {recipe.ingredients.map((ingredient, index) => (
                        <li key={index} className="mb-0">
                          <span className="font-medium leading-[26px] text-[16px] text-neutral-700">
                            {ingredient}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Instructions */}
                {recipe.instructions && (
                  <div className="h-auto relative shrink-0 w-full">
                    <p className="font-semibold leading-[32px] mb-4 text-[20px]">Instructions</p>
                    <p className="font-medium leading-[26px] text-[16px] whitespace-pre-wrap">
                      {recipe.instructions}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Save Button Footer - Only in Edit Mode */}
          {isEditMode && (
            <div className="sticky bottom-0 bg-white border-t p-4">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasUnsavedChanges}
                className="w-full"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete "{recipe.title}"? This action cannot be undone.</p>
            {deleteError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)} 
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
