"use client"

import { useState, useEffect, useRef } from 'react'
import { DataTable } from './data-table'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  async function fetchRecipes() {
    setLoading(true)
    const res = await fetch('/api/recipes/list')
    const data = await res.json()
    setRecipes(data.recipes)
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchRecipes()
    setRefreshing(false)
  }

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

  return (
    <div 
      ref={containerRef}
      className="container mx-auto p-3 sm:p-4 max-w-full h-full overflow-auto"
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
      
      <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Recipes</h1>
      <DataTable recipes={recipes} onRefresh={fetchRecipes} loading={loading || refreshing} />
    </div>
  )
}