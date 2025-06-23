"use client"

import { useState, useEffect } from 'react'
import { DataTable } from './data-table'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchRecipes() {
    setLoading(true)
    const res = await fetch('/api/recipes/list')
    const data = await res.json()
    setRecipes(data.recipes)
    setLoading(false)
  }

  useEffect(() => {
    fetchRecipes()
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Recipes</h1>
      <DataTable recipes={recipes} onRefresh={fetchRecipes} loading={loading} />
    </div>
  )
}