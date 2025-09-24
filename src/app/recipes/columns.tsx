"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { getMonthName } from "@/lib/utils"
import Link from 'next/link'

export type Recipe = {
  id: number
  title: string
  summary: string
  instructions: string
  rawIngredients: string // JSON string of ingredients
  tags?: string // JSON string of tags
  startSeason: number
  endSeason: number
  grade: number
  time: number
  preparationTime?: number | null // minutes for preparation
  cookingTime?: number | null // minutes for cooking
  createdAt: Date
  updatedAt: Date
  image?: string | null // URL to recipe image
  ingredients: { name: string; startSeason: number; endSeason: number }[]
}

export const columns: ColumnDef<Recipe>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Title
          {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
        </Button>
      )
    },
    cell: ({ row }) => {
      const recipe = row.original
      return (
        <div className="flex items-center gap-3">
                     <img 
             src={recipe.image || '/placeholder-recipe.svg'} 
             alt={`${recipe.title} recipe image`}
             className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0"
             loading="lazy"
             onError={(e) => {
               // Fallback to placeholder if image fails to load
               const img = e.target as HTMLImageElement
               img.src = '/placeholder-recipe.svg'
               img.onerror = null // Prevent infinite loop
             }}
           />
          <Link
            href={`/recipes/${recipe.id}`}
            className='text-blue-600 hover:underline'
          >
            {recipe.title}
          </Link>
        </div>
      )
    }
  },
  {
    accessorKey: "summary",
    header: "Summary",
    cell: ({ row }) => (
      <div className="w-120 whitespace-pre-line break-words">
        {row.getValue("summary")}
      </div>
    ),
  },
  {
    accessorKey: "ingredients",
    header: "Ingredients",
    cell: ({ row }) => {
      const ingredients = row.getValue("ingredients") as { name: string }[]
      return ingredients.map((ing) => ing.name).join(", ")
    },
  },
  {
    accessorKey: "startSeason",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Season
          {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
        </Button>
      )
    },
    cell: ({ row }) => {
      const startSeason = row.getValue("startSeason") as number
      const endSeason = row.original.endSeason as number
      return `${getMonthName(startSeason)} to ${getMonthName(endSeason)}`
    },
  },
  {
    accessorKey: "grade",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Grade
          {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
        </Button>
      )
    },
  },
  {
    accessorKey: "time",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Time (min)
          {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
        </Button>
      )
    },
  },
  
]