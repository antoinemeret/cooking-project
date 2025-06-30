'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCw, Search, ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react'
import { formatIngredientForDisplay } from '@/lib/grocery-utils'

interface AggregatedIngredient {
  name: string
  quantity?: number
  unit?: string
  sources: string[]
  checked: boolean
}

interface GroceryStats {
  total: number
  checked: number
  remaining: number
  percentComplete: number
}

export default function GroceriesPage() {
  const [groceryList, setGroceryList] = useState<AggregatedIngredient[]>([])
  const [stats, setStats] = useState<GroceryStats>({
    total: 0,
    checked: 0,
    remaining: 0,
    percentComplete: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Mock user ID for development
  const userId = 'user123'

  const fetchGroceryList = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching grocery list for user:', userId)
      const response = await fetch(`/api/groceries?userId=${userId}`)
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch grocery list`)
      }
      
      const data = await response.json()
      console.log('Grocery list data:', data)
      
      setGroceryList(data.groceryList || [])
      setStats(data.stats || { total: 0, checked: 0, remaining: 0, percentComplete: 0 })
    } catch (err) {
      console.error('Error fetching grocery list:', err)
      setError('Failed to load grocery list')
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroceryList()
  }, [])

  const handleToggleItem = async (ingredient: AggregatedIngredient, checked: boolean) => {
    setIsUpdating(true)
    
    try {
      // Optimistic update for better UX
      setGroceryList(prev => 
        prev.map(item => 
          item.name === ingredient.name 
            ? { ...item, checked }
            : item
        )
      )
      
      // Update stats optimistically
      setStats(prev => {
        const newChecked = checked ? prev.checked + 1 : prev.checked - 1
        const newRemaining = prev.total - newChecked
        const newPercentComplete = prev.total > 0 ? Math.round((newChecked / prev.total) * 100) : 0
        
        return {
          ...prev,
          checked: newChecked,
          remaining: newRemaining,
          percentComplete: newPercentComplete
        }
      })
      
      // Make API call to persist the change
      const response = await fetch('/api/groceries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ingredientName: ingredient.name,
          checked
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update grocery item')
      }
      
      console.log('Grocery item updated successfully')
      
    } catch (error) {
      console.error('Error updating grocery item:', error)
      // Revert optimistic update on error
      setGroceryList(prev => 
        prev.map(item => 
          item.name === ingredient.name 
            ? { ...item, checked: !checked }
            : item
        )
      )
      // Revert stats
      setStats(prev => {
        const newChecked = checked ? prev.checked - 1 : prev.checked + 1
        const newRemaining = prev.total - newChecked
        const newPercentComplete = prev.total > 0 ? Math.round((newChecked / prev.total) * 100) : 0
        
        return {
          ...prev,
          checked: newChecked,
          remaining: newRemaining,
          percentComplete: newPercentComplete
        }
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClearCompleted = async () => {
    setIsClearing(true)
    
    try {
      const response = await fetch(`/api/groceries?userId=${userId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to clear completed items')
      }
      
      // Refresh the grocery list
      await fetchGroceryList()
      
      console.log('Completed items cleared successfully')
      
    } catch (error) {
      console.error('Error clearing completed items:', error)
    } finally {
      setIsClearing(false)
    }
  }

  // Filter items based on search query
  const filteredGroceryList = groceryList.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sources.some(source => source.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Separate checked and unchecked items for better organization
  const uncheckedItems = filteredGroceryList.filter(item => !item.checked)
  const checkedItems = filteredGroceryList.filter(item => item.checked)

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 max-w-full">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your grocery list...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-3 sm:p-4 max-w-full">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold mb-2">Error Loading Grocery List</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchGroceryList}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1">Grocery List</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {stats.total === 0 
              ? "No items in your grocery list"
              : `${stats.checked}/${stats.total} items purchased (${stats.percentComplete}%)`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchGroceryList}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {stats.checked > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleClearCompleted}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Completed
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-md">
            <div className="text-6xl sm:text-7xl mb-4">🛒</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-3">No Grocery List Yet</h2>
            <p className="text-muted-foreground mb-6">
              Your grocery list will be automatically generated from your meal plan. 
              Start by planning some meals with the AI assistant.
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={() => window.location.href = '/assistant'}
                className="px-6"
              >
                Plan Meals
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/planner'}
                className="px-6"
              >
                View Planner
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Progress */}
      {stats.total > 0 && (
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients or recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Progress Bar */}
          <div className="bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300 ease-out"
              style={{ width: `${stats.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Grocery List */}
      {stats.total > 0 && (
        <div className="space-y-6">
          {/* Unchecked Items */}
          {uncheckedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopping List ({uncheckedItems.length} items)
              </h2>
              <div className="space-y-2">
                {uncheckedItems.map((ingredient, index) => (
                  <div
                    key={`${ingredient.name}-${index}`}
                    className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={ingredient.checked}
                      onCheckedChange={(checked) => handleToggleItem(ingredient, checked as boolean)}
                      disabled={isUpdating}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        {formatIngredientForDisplay(ingredient)}
                      </p>
                      {ingredient.sources.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          From: {ingredient.sources.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checked Items */}
          {checkedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Purchased ({checkedItems.length} items)
              </h2>
              <div className="space-y-2">
                {checkedItems.map((ingredient, index) => (
                  <div
                    key={`${ingredient.name}-${index}`}
                    className="flex items-start gap-3 p-3 bg-muted/30 border border-border rounded-lg"
                  >
                    <Checkbox
                      checked={ingredient.checked}
                      onCheckedChange={(checked) => handleToggleItem(ingredient, checked as boolean)}
                      disabled={isUpdating}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-muted-foreground line-through">
                        {formatIngredientForDisplay(ingredient)}
                      </p>
                      {ingredient.sources.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          From: {ingredient.sources.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {filteredGroceryList.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🔍</div>
              <h3 className="text-lg font-semibold mb-1">No items found</h3>
              <p className="text-muted-foreground">
                No ingredients match "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 