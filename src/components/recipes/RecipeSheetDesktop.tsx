'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CalendarPlus, Edit, Heart, Trash2, X } from 'lucide-react'

interface Recipe {
  id: number
  title: string
  summary: string
  time: number
  image?: string | null
  preparationTime?: number | null
  cookingTime?: number | null
  ingredients?: string[]
  instructions?: string
}

interface RecipeSheetDesktopProps {
  recipe: Recipe
  isOpen: boolean
  onClose: () => void
  onAddToPlanner?: (recipeId: number) => void
  onMoreActions?: (recipeId: number, action: string) => void
  initialAction?: string
}

export function RecipeSheetDesktop({
  recipe,
  isOpen,
  onClose,
  onAddToPlanner,
  onMoreActions,
  initialAction
}: RecipeSheetDesktopProps) {
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
      }
    }

    if (isEditMode && isOpen) {
      window.addEventListener('scroll', handleScroll, { passive: false })
      document.addEventListener('scroll', handleScroll, { passive: false })
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('scroll', handleScroll)
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
          rawIngredients: editFields.rawIngredients,
          instructions: editFields.instructions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to save recipe'
        throw new Error(errorMessage)
      }

      setIsEditMode(false)
      setHasUnsavedChanges(false)
      onMoreActions(recipe.id, 'refresh') // Refresh the list
    } catch (error) {
      console.error('Save error:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save recipe')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditMode(false)
    setEditFields({
      title: recipe.title,
      rawIngredients: recipe.ingredients?.join('\n') || '',
      instructions: recipe.instructions || ''
    })
    setSaveError(null)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'DELETE',
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

  return createPortal(
    <>
      {/* Backdrop overlay - covers entire screen including sidebar */}
      <div className="fixed inset-0 bg-black/50 z-[9999]" onClick={onClose} />
      
      {/* Recipe sheet - Desktop version */}
      <div className="fixed inset-0 z-[10000] pointer-events-none">
        <div className="absolute right-0 top-0 w-[767px] h-full bg-white pointer-events-auto overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header with image */}
            <div className={`relative ${recipe.image ? 'h-[352px]' : 'h-[180px]'} flex-shrink-0`}>
              {/* Recipe image */}
              <div className={`absolute bg-white left-0 top-0 w-full overflow-hidden ${recipe.image ? 'h-[312px]' : 'h-[180px]'}`}>
                {recipe.image && (
                  <div 
                    className="absolute bg-center bg-cover bg-no-repeat left-1/2 size-full translate-x-[-50%] translate-y-[-50%]"
                    style={{ 
                      top: "calc(50% - 0.5px)", 
                      backgroundImage: `url('${recipe.image}')` 
                    }} 
                  />
                )}
                {recipe.image && (
                  <div className="absolute inset-0 pointer-events-none shadow-[0px_60px_30px_-25px_inset_rgba(0,0,0,0.5)]" />
                )}
              </div>
              
              {/* Back button */}
              <button
                onClick={onClose}
                className={`absolute left-5 size-6 z-10 ${recipe.image ? 'top-2.5' : 'top-4'}`}
              >
                <X className={`size-6 ${recipe.image ? 'text-white' : 'text-[#212b36]'}`} />
              </button>
              
              {/* Recipe title card */}
              <div className={`absolute bg-[#f3f3f3] box-border flex flex-col gap-2 items-center justify-start left-1/2 px-4 py-5 rounded-[8px] ${recipe.image ? 'top-60' : 'top-16'} translate-x-[-50%] w-[711px]`}>
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
                    <X className="size-[22px] text-[#212b36]" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAction('edit')}
                      className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity"
                    >
                      <Edit className="size-[22px] text-[#212b36]" />
                    </button>
                    <button
                      onClick={() => handleAction('favorite')}
                      className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity"
                    >
                      <Heart className="size-[22px] text-[#212b36]" />
                    </button>
                    <button
                      onClick={() => handleAction('delete')}
                      className="relative shrink-0 size-[22px] hover:opacity-80 transition-opacity"
                    >
                      <Trash2 className="size-[22px] text-[#212b36]" />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={handleAddToPlanner}
                className="bg-neutral-700 overflow-clip relative rounded-[18px] shrink-0 size-8 hover:bg-neutral-800 transition-colors"
              >
                <CalendarPlus className="absolute left-1/2 size-[18px] top-1/2 translate-x-[-50%] translate-y-[-50%] text-white" />
              </button>
            </div>
              </div>
            </div>
            
            {/* Recipe content - scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-5">
              <div className="flex flex-col font-bold gap-5 items-start justify-start text-neutral-700 w-full">
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
            </div>

            {/* Save Button Footer - Only in Edit Mode */}
            {isEditMode && (
              <div className="sticky bottom-0 bg-white border-t p-4 flex-shrink-0">
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
      </div>

      {/* Delete Confirmation Dialog - Custom implementation to ensure proper z-index */}
      {isDeleteDialogOpen && (
        <>
          {/* Custom backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[10000]" 
            onClick={() => setIsDeleteDialogOpen(false)}
          />
          
          {/* Custom dialog content */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10001] bg-white rounded-lg border p-6 shadow-lg w-full max-w-md">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Delete Recipe</h2>
              <p>Are you sure you want to delete "{recipe.title}"? This action cannot be undone.</p>
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  )
}
