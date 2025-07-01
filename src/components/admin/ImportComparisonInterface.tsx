'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  Globe, 
  AlertTriangle,
  LoaderCircle,
  Timer,
  Activity
} from 'lucide-react'
import type { ImportComparisonResponse } from '@/types/comparison'

export function ImportComparisonInterface() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImportComparisonResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/recipes/import-comparison', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setUrl('')
    setResult(null)
    setError(null)
  }

  const formatTime = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`
    return `${(milliseconds / 1000).toFixed(1)}s`
  }

  const getStatusIcon = (success: boolean, hasError: boolean) => {
    if (hasError) return <XCircle className="h-4 w-4 text-destructive" />
    if (success) return <CheckCircle className="h-4 w-4 text-green-600" />
    return <AlertTriangle className="h-4 w-4 text-amber-600" />
  }

  const getStatusBadge = (success: boolean, hasError: boolean) => {
    if (hasError) return <Badge variant="destructive">Failed</Badge>
    if (success) return <Badge className="bg-green-100 text-green-800 border-green-300">Success</Badge>
    return <Badge variant="secondary">Incomplete</Badge>
  }

  return (
    <div className="space-y-6">
      {/* URL Input Form */}
      <Card className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="recipe-url" className="block text-sm font-medium mb-2">
              Recipe URL to Compare
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recipe-url"
                  type="url"
                  placeholder="https://example.com/recipe"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
              <Button type="submit" disabled={!url.trim() || isLoading}>
                {isLoading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  'Compare'
                )}
              </Button>
              {result && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              )}
            </div>
          </div>
          
          {url && (
            <p className="text-sm text-muted-foreground">
              This will test both Ollama and Traditional parsing approaches simultaneously
            </p>
          )}
        </form>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Running comparison tests...</p>
              <p className="text-sm text-muted-foreground">
                Testing both technologies in parallel (may take 10-30 seconds)
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-6 border-destructive">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive mb-1">Comparison Failed</h3>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Comparison Overview */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Comparison Results</h3>
              <Badge variant="outline" className="font-mono">
                ID: {result.comparisonId.substring(0, 8)}...
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Started:</span>
                <span className="font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Source:</span>
                <span className="font-mono text-xs">
                  {new URL(url).hostname}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">Complete</span>
              </div>
            </div>
          </Card>

          {/* Side-by-Side Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ollama Results */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-full"></div>
                  <h4 className="font-semibold">Ollama LLM</h4>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.results.ollama.success, !!result.results.ollama.error)}
                  {getStatusBadge(result.results.ollama.success, !!result.results.ollama.error)}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processing Time:</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono font-medium">
                      {formatTime(result.results.ollama.processingTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recipe Data */}
              {result.results.ollama.success && result.results.ollama.recipe && (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium mb-2">Title</h5>
                    <p className="text-sm p-2 bg-muted/30 rounded">
                      {result.results.ollama.recipe.title || 'No title extracted'}
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">
                      Ingredients ({result.results.ollama.recipe.ingredients?.length || 0})
                    </h5>
                    <div className="text-sm p-2 bg-muted/30 rounded max-h-32 overflow-y-auto">
                      {result.results.ollama.recipe.ingredients?.length ? (
                        <ul className="space-y-1">
                          {result.results.ollama.recipe.ingredients.map((ingredient, idx) => (
                            <li key={idx}>• {ingredient}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">No ingredients extracted</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Instructions</h5>
                    <div className="text-sm p-2 bg-muted/30 rounded max-h-32 overflow-y-auto">
                      {result.results.ollama.recipe.instructions || (
                        <span className="text-muted-foreground">No instructions extracted</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {result.results.ollama.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium mb-1">Error:</p>
                  <p className="text-xs text-destructive/80">{result.results.ollama.error}</p>
                </div>
              )}
            </Card>

            {/* Traditional Parsing Results */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"></div>
                  <h4 className="font-semibold">Traditional Parser</h4>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.results.traditional.success, !!result.results.traditional.error)}
                  {getStatusBadge(result.results.traditional.success, !!result.results.traditional.error)}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Processing Time:</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono font-medium">
                      {formatTime(result.results.traditional.processingTime)}
                    </span>
                  </div>
                </div>
                {result.results.traditional.success && result.results.traditional.parsingMethod && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Method Used:</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {result.results.traditional.parsingMethod}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Recipe Data */}
              {result.results.traditional.success && result.results.traditional.recipe && (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium mb-2">Title</h5>
                    <p className="text-sm p-2 bg-muted/30 rounded">
                      {result.results.traditional.recipe.title || 'No title extracted'}
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">
                      Ingredients ({result.results.traditional.recipe.ingredients?.length || 0})
                    </h5>
                    <div className="text-sm p-2 bg-muted/30 rounded max-h-32 overflow-y-auto">
                      {result.results.traditional.recipe.ingredients?.length ? (
                        <ul className="space-y-1">
                          {result.results.traditional.recipe.ingredients.map((ingredient: string, idx: number) => (
                            <li key={idx}>• {ingredient}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">No ingredients extracted</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Instructions</h5>
                    <div className="text-sm p-2 bg-muted/30 rounded max-h-32 overflow-y-auto">
                      {result.results.traditional.recipe.instructions || (
                        <span className="text-muted-foreground">No instructions extracted</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {result.results.traditional.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium mb-1">Error:</p>
                  <p className="text-xs text-destructive/80">{result.results.traditional.error}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Performance Comparison Summary */}
          <Card className="p-4 sm:p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance Comparison
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold text-sm text-muted-foreground mb-1">Speed Winner</div>
                <div className="font-mono text-lg">
                  {result.results.ollama.processingTime < result.results.traditional.processingTime ? '🔥 Ollama' : '⚡ Traditional'}
                </div>
                <div className="text-xs text-muted-foreground">
                  ({Math.abs(result.results.ollama.processingTime - result.results.traditional.processingTime)}ms difference)
                </div>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold text-sm text-muted-foreground mb-1">Success Rate</div>
                <div className="font-mono text-lg">
                  {result.results.ollama.success && result.results.traditional.success ? '✅ Both' :
                   result.results.ollama.success ? '🔥 Ollama' :
                   result.results.traditional.success ? '⚡ Traditional' : '❌ Neither'}
                </div>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="font-semibold text-sm text-muted-foreground mb-1">Total Time</div>
                <div className="font-mono text-lg">
                  {formatTime(Math.max(result.results.ollama.processingTime, result.results.traditional.processingTime))}
                </div>
                <div className="text-xs text-muted-foreground">
                  (Parallel execution)
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
} 