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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { toast } from "sonner"

type ImportedRecipe = {
  id?: number
  title: string
  rawIngredients: string[]
  instructions: string
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

  const openReviewDialog = (recipe: ImportedRecipe) => {
    setImportedRecipe(recipe)
    setIsManualMode(false)
    setIsImportDialogOpen(true)
  }

  const handlePhotoImportClick = () => {
    photoInputRef.current?.click()
  }

  const handleUrlImport = async () => {
    if (!importUrl) return
    setIsImporting(true)
    setImportStatus("Scraping URL...")
    setImportError("")
    try {
      const res = await fetch(`/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      })
      if (res.ok) {
        const newRecipe = await res.json()
        openReviewDialog(newRecipe)
      } else {
        setImportError("Could not import recipe from URL.")
      }
    } catch (err) {
      setImportError("An error occurred while importing from URL.")
    }
    setIsImporting(false)
    setImportStatus("Add new")
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
          openReviewDialog(eventData.data as ImportedRecipe)
          setImportStatus("Done!")
        }

        if (eventData.status === "error") {
          toast.error("Could not read recipe. Please try a clearer photo.", {
            action: {
              label: "Import Manually",
              onClick: () => {
                setImportedRecipe({ title: "", rawIngredients: [], instructions: "" })
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
            setImportedRecipe({ title: "", rawIngredients: [], instructions: "" })
            setIsManualMode(true)
            setIsImportDialogOpen(true)
          },
        },
      })
    } finally {
      setIsImporting(false)
      setTimeout(() => setImportStatus("Add new"), 3000)
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
          <DropdownMenu>
            <DropdownMenuTrigger>Open</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem>Team</DropdownMenuItem>
              <DropdownMenuItem>Subscription</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ImportRecipeDialog
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
            recipe={importedRecipe}
            setRecipe={setImportedRecipe}
            isManualMode={isManualMode}
            setIsManualMode={setIsManualMode}
            onImport={onRefresh}
            setProcessingRecipeId={setProcessingRecipeId}
            // Pass state and handlers for URL import
            url={importUrl}
            setUrl={setImportUrl}
            onUrlImport={handleUrlImport}
            loading={isImporting}
            error={importError}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isImporting}>
                {isImporting ? importStatus : "Add new"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => {
                  setImportedRecipe({ title: "", rawIngredients: [], instructions: "" })
                  setIsManualMode(true)
                  setIsImportDialogOpen(true)
                }}
              >
                Create manually
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setImportedRecipe(null)
                  setIsManualMode(false)
                  setIsImportDialogOpen(true)
                }}
              >
                Import from URL
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
                      <Sheet open={selectedRecipe !== null} onOpenChange={(newOpen) => {
                        if (!newOpen) {
                          setSelectedRecipe(null)
                        }
                      }}>
                        <SheetTrigger asChild>
                          <button
                            className='text-blue-600 hover:underline'
                            onClick={() => setSelectedRecipe(row.original)}
                          >
                            {row.original.title}
                          </button>
                        </SheetTrigger>
                        <SheetContent className="w-[50%] min-w-[320px] p-6 flex flex-col gap-6">
                            <SheetHeader>
                                 <SheetTitle className="text-2xl font-bold">{selectedRecipe?.title}</SheetTitle>
                             </SheetHeader>
                            <div className="flex flex-col gap-4">
                             <div>
                                 <h2 className="text-lg font-semibold mb-2">Ingredients</h2>
                                 <ul className="list-disc list-inside pl-4 space-y-1">
                                    {selectedRecipe?.rawIngredients && JSON.parse(selectedRecipe.rawIngredients).map((ingredient: string) => (
                                    <li key={ingredient}>{ingredient}</li>))}
                                </ul>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                                <p className="whitespace-pre-line">{selectedRecipe?.instructions}</p>
                            </div>
                        </div>
                    </SheetContent>
                      </Sheet>
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
}: ImportRecipeDialogProps) {
  function handleReset() {
    setIsManualMode(false)
    setRecipe(null)
    setUrl('')
  }

  async function handleValidate() {
    if (!recipe) return

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe),
      })
      if (!res.ok) throw new Error('Failed to save recipe')
      const { recipe: savedRecipe } = await res.json()

      onImport()
      onOpenChange(false)
      setProcessingRecipeId(savedRecipe.id)
      handleReset()

      // Run background tasks without blocking the UI
      const runBackgroundTasks = async () => {
        try {
          const processPromise = fetch('/api/recipes/process-ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId: savedRecipe.id }),
          })

          const summaryPromise = fetch('/api/recipes/generate-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId: savedRecipe.id }),
          })

          await Promise.all([processPromise, summaryPromise])
        } catch (err) {
          console.error('Error during background processing:', err)
        } finally {
          onImport()
          setProcessingRecipeId(null)
        }
      }

      runBackgroundTasks()
    } catch (err) {
      console.error('Error saving recipe:', err)
      setProcessingRecipeId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleReset();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isManualMode ? "Create Recipe" : recipe ? "Review Recipe" : "Import from URL"}</DialogTitle>
        </DialogHeader>
        {isManualMode || recipe ? (
          <ValidateRecipeForm
            recipe={recipe}
            setRecipe={setRecipe}
            onValidate={handleValidate}
            isManualMode={isManualMode}
            loading={loading}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter recipe URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <Button onClick={onUrlImport} disabled={loading}>
                {loading ? 'Importing...' : 'Import'}
              </Button>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type ValidateRecipeFormProps = {
  recipe: ImportedRecipe | null;
  setRecipe: (recipe: ImportedRecipe | null) => void;
  onValidate: () => void;
  isManualMode: boolean;
  loading: boolean;
};

function ValidateRecipeForm({
  recipe,
  setRecipe,
  onValidate,
  isManualMode,
  loading,
}: ValidateRecipeFormProps) {
  const handleRecipeChange = (
    field: keyof ImportedRecipe,
    value: string | string[]
  ) => {
    if (recipe) {
      setRecipe({ ...recipe, [field]: value });
    }
  };

  const currentRecipe = recipe || { title: '', rawIngredients: [], instructions: '' };

  if (!recipe && !isManualMode) return null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label>Title</label>
        <Input
          value={currentRecipe.title}
          onChange={(e) => handleRecipeChange('title', e.target.value)}
        />
      </div>
      <div>
        <label>Ingredients</label>
        <textarea
          className="w-full p-2 border rounded"
          rows={5}
          value={(currentRecipe.rawIngredients || []).join('\n')}
          onChange={(e) => handleRecipeChange('rawIngredients', e.target.value.split('\n'))}
        />
      </div>
      <div>
        <label>Instructions</label>
        <textarea
          className="w-full p-2 border rounded"
          rows={8}
          value={currentRecipe.instructions}
          onChange={(e) => handleRecipeChange('instructions', e.target.value)}
        />
      </div>
      <Button onClick={onValidate} disabled={loading}>{loading ? 'Saving...' : 'Save Recipe'}</Button>
    </div>
  )
}