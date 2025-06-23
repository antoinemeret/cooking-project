"use client"

import { useState, useEffect } from "react"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { PhotoImportButton } from "@/components/photo-import-button"

type ImportedRecipe = {
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
          <ImportRecipeDialog
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
            recipe={importedRecipe}
            setRecipe={setImportedRecipe}
            isManualMode={isManualMode}
            setIsManualMode={setIsManualMode}
            onImport={onRefresh}
            setProcessingRecipeId={setProcessingRecipeId}
          />
          <PhotoImportButton
            onImportSuccess={(recipe) => {
              setImportedRecipe(recipe);
              setIsImportDialogOpen(true);
            }}
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
}: ImportRecipeDialogProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleReset() {
    setIsManualMode(false)
    setRecipe(null)
    setUrl('')
    setError('')
  }

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      handleReset()
    }
  }, [open])

  async function handleImport() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (!res.ok) throw new Error('Failed to fetch or parse')
      const data = await res.json()
      setRecipe(data.recipe as ImportedRecipe)
    } catch (err) {
      setError('Could not import recipe.')
    }
    setLoading(false)
  }

  async function handleValidate() {
    setLoading(true)
    setError('')
    try {
      // 1. Save the recipe
      const saveRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe)
      })
      if (!saveRes.ok) throw new Error('Failed to save recipe')
      const { recipe: savedRecipe } = await saveRes.json()
      onOpenChange(false)
      onImport()
      setProcessingRecipeId(savedRecipe.id)
      // 2. Process ingredients in background
      const processRes = await fetch('/api/recipes/process-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: savedRecipe.id })
      })
      if (processRes.ok) onImport()
      // 3. Generate summary in background
      const summaryRes = await fetch('/api/recipes/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: savedRecipe.id })
      })
      if (summaryRes.ok) onImport()
      setProcessingRecipeId(null)
    } catch (err) {
      setError('Error saving, processing, or summarizing recipe')
      console.error('Validation error:', err)
      setProcessingRecipeId(null)
    } finally {
      setLoading(false)
    }
  }

  function handleManualMode() {
    setIsManualMode(true)
    setRecipe({
      title: '',
      rawIngredients: [],
      instructions: ''
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Import from URL</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Recipe from URL</DialogTitle>
        </DialogHeader>
        {!recipe ? (
          <>
            <Input
              placeholder="Paste recipe URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={loading}
            />
            <div className="flex flex-col gap-2">
              <Button onClick={handleImport} disabled={loading || !url}>
                {loading ? 'Importing...' : 'Import'}
              </Button>
              <div className="text-center text-sm text-gray-500">
                Or <button onClick={handleManualMode} className="text-blue-600 hover:underline">import manually</button>
              </div>
            </div>
            {error && <div className="text-red-500">{error}</div>}
          </>
        ) : (
          <>
            {/* Editable fields for recipe */}
            <Input
              value={recipe?.title ?? ''}
              onChange={e => setRecipe({ ...recipe, title: e.target.value })}
              className="mb-2"
              placeholder="Recipe title"
            />
            <textarea
              value={Array.isArray(recipe?.rawIngredients) ? recipe.rawIngredients.join('\n') : ''}
              onChange={e => setRecipe({ ...recipe, rawIngredients: e.target.value.split('\n') })}
              className="mb-2 w-full border rounded p-2"
              rows={5}
              placeholder="Enter ingredients (one per line)"
            />
            <textarea
              value={recipe?.instructions ?? ''}
              onChange={e => setRecipe({ ...recipe, instructions: e.target.value })}
              className="mb-2 w-full border rounded p-2"
              rows={5}
              placeholder="Enter recipe instructions"
            />
            <DialogFooter>
              <Button onClick={handleValidate} disabled={loading || !recipe.title}>
                {loading ? 'Processing...' : 'Save'}
              </Button>
              {error && <div className="text-red-500 ml-4 self-center">{error}</div>}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}