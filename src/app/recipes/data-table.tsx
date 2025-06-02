"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getMonthName } from "@/lib/utils"

type Recipe = {
  id: number
  title: string
  summary: string
  instructions: string
  startSeason: number
  endSeason: number
  grade: number
  time: number
  createdAt: Date
  updatedAt: Date
  ingredients: { name: string; startSeason: number; endSeason: number }[]
}

export function DataTable({ recipes }: { recipes: Recipe[] }) {
  const [sortField, setSortField] = useState<keyof Recipe>("title")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Filter recipes based on search term
  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.summary.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort recipes
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (sortDirection === "asc") {
      return a[sortField] > b[sortField] ? 1 : -1
    } else {
      return a[sortField] < b[sortField] ? 1 : -1
    }
  })

  // Paginate recipes
  const totalPages = Math.ceil(sortedRecipes.length / itemsPerPage)
  const paginatedRecipes = sortedRecipes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Handle sort
  const handleSort = (field: keyof Recipe) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
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
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("title")}
              >
                Title {sortField === "title" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("startSeason")}
              >
                Season {sortField === "startSeason" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("grade")}
              >
                Grade {sortField === "grade" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort("time")}
              >
                Time {sortField === "time" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </TableHead>
            <TableHead>Ingredients</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRecipes.map((recipe) => (
            <TableRow key={recipe.id}>
              <TableCell>{recipe.title}</TableCell>
              <TableCell>{recipe.summary}</TableCell>
              <TableCell>
                {getMonthName(recipe.startSeason)} to {getMonthName(recipe.endSeason)}
              </TableCell>
              <TableCell>{recipe.grade}</TableCell>
              <TableCell>{recipe.time}</TableCell>
              <TableCell>
                {recipe.ingredients.map((ing) => ing.name).join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  )
}