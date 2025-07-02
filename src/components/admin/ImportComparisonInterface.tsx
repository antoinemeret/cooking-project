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
  Activity,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Star
} from 'lucide-react'
import type { ImportComparisonResponse } from '@/types/comparison'

interface ManualScores {
  ollama: {
    titleScore: number | null
    ingredientsScore: number | null
    instructionsScore: number | null
    totalScore: number | null
  }
  traditional: {
    titleScore: number | null
    ingredientsScore: number | null
    instructionsScore: number | null
    totalScore: number | null
  }
}

export function ImportComparisonInterface() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImportComparisonResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualScores, setManualScores] = useState<ManualScores>({
    ollama: { titleScore: null, ingredientsScore: null, instructionsScore: null, totalScore: null },
    traditional: { titleScore: null, ingredientsScore: null, instructionsScore: null, totalScore: null }
  })
  const [scoringMessage, setScoringMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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
    setManualScores({
      ollama: { titleScore: null, ingredientsScore: null, instructionsScore: null, totalScore: null },
      traditional: { titleScore: null, ingredientsScore: null, instructionsScore: null, totalScore: null }
    })
    setScoringMessage(null)
  }

  const handleManualScore = async (technology: 'ollama' | 'traditional', field: 'title' | 'ingredients' | 'instructions', score: number) => {
    if (!result) return

    try {
      const response = await fetch('/api/recipes/import-comparison/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonId: result.comparisonId,
          technology,
          evaluation: {
            [`${field}Score`]: score,
            evaluatorNotes: `Manual scoring: ${field} scored ${score === 1 ? 'Good (+1)' : score === 0 ? 'Neutral (0)' : 'Bad (-1)'}`
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit manual score')
      }

      // Calculate total score for this technology
      const currentScores = { ...manualScores[technology] }
      currentScores[`${field}Score` as keyof typeof currentScores] = score
      
      const totalScore = [currentScores.titleScore, currentScores.ingredientsScore, currentScores.instructionsScore]
        .filter(s => s !== null)
        .reduce((sum, s) => sum + (s || 0), 0)

      // Update local state
      setManualScores(prev => ({
        ...prev,
        [technology]: {
          ...currentScores,
          totalScore: currentScores.titleScore !== null && currentScores.ingredientsScore !== null && currentScores.instructionsScore !== null 
            ? totalScore 
            : null
        }
      }))

      setScoringMessage({ type: 'success', text: `Score ${score === 1 ? '(+1)' : score === 0 ? '(0)' : '(-1)'} submitted for ${technology} ${field}` })
      setTimeout(() => setScoringMessage(null), 3000)
    } catch (error) {
      console.error('Error submitting manual score:', error)
      setScoringMessage({ type: 'error', text: 'Failed to submit manual score' })
      setTimeout(() => setScoringMessage(null), 3000)
    }
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

  const ScoreButtons = ({ 
    technology, 
    field, 
    currentScore 
  }: { 
    technology: 'ollama' | 'traditional'
    field: 'title' | 'ingredients' | 'instructions'
    currentScore: number | null 
  }) => (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={currentScore === 1 ? "default" : "outline"}
        onClick={() => handleManualScore(technology, field, 1)}
        className={`h-7 px-2 ${currentScore === 1 ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 hover:border-green-300'}`}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant={currentScore === 0 ? "default" : "outline"}
        onClick={() => handleManualScore(technology, field, 0)}
        className={`h-7 px-2 ${currentScore === 0 ? 'bg-gray-600 hover:bg-gray-700' : 'hover:bg-gray-50 hover:border-gray-300'}`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant={currentScore === -1 ? "default" : "outline"}
        onClick={() => handleManualScore(technology, field, -1)}
        className={`h-7 px-2 ${currentScore === -1 ? 'bg-red-600 hover:bg-red-700' : 'hover:bg-red-50 hover:border-red-300'}`}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  )

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

          {/* Manual Quality Scoring */}
          <Card className="p-4 sm:p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Manual Quality Scoring
            </h4>
            
            {/* Scoring Message */}
            {scoringMessage && (
              <div className={`mb-4 p-3 rounded-lg border ${
                scoringMessage.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <p className="text-sm font-medium">{scoringMessage.text}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Scoring Legend:</strong> 
                <span className="ml-2">👍 Good (+1)</span>
                <span className="ml-2">➖ Neutral (0)</span>
                <span className="ml-2">👎 Bad (-1)</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Total Score = Sum of all three fields. Range: -3 to +3
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ollama Scoring */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="w-3 h-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-full"></div>
                  <h5 className="font-semibold">Ollama LLM</h5>
                  {manualScores.ollama.totalScore !== null && (
                    <Badge variant="outline" className="ml-auto font-mono">
                      Total: {manualScores.ollama.totalScore > 0 ? '+' : ''}{manualScores.ollama.totalScore}
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Title Quality</span>
                    <ScoreButtons 
                      technology="ollama" 
                      field="title" 
                      currentScore={manualScores.ollama.titleScore} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ingredients Quality</span>
                    <ScoreButtons 
                      technology="ollama" 
                      field="ingredients" 
                      currentScore={manualScores.ollama.ingredientsScore} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Instructions Quality</span>
                    <ScoreButtons 
                      technology="ollama" 
                      field="instructions" 
                      currentScore={manualScores.ollama.instructionsScore} 
                    />
                  </div>
                </div>
              </div>

              {/* Traditional Scoring */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"></div>
                  <h5 className="font-semibold">Traditional Parser</h5>
                  {manualScores.traditional.totalScore !== null && (
                    <Badge variant="outline" className="ml-auto font-mono">
                      Total: {manualScores.traditional.totalScore > 0 ? '+' : ''}{manualScores.traditional.totalScore}
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Title Quality</span>
                    <ScoreButtons 
                      technology="traditional" 
                      field="title" 
                      currentScore={manualScores.traditional.titleScore} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ingredients Quality</span>
                    <ScoreButtons 
                      technology="traditional" 
                      field="ingredients" 
                      currentScore={manualScores.traditional.ingredientsScore} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Instructions Quality</span>
                    <ScoreButtons 
                      technology="traditional" 
                      field="instructions" 
                      currentScore={manualScores.traditional.instructionsScore} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Score Summary */}
            {(manualScores.ollama.totalScore !== null || manualScores.traditional.totalScore !== null) && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-center gap-8">
                  {manualScores.ollama.totalScore !== null && (
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Ollama Total</div>
                      <div className={`text-2xl font-bold ${
                        manualScores.ollama.totalScore > 0 ? 'text-green-600' : 
                        manualScores.ollama.totalScore < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {manualScores.ollama.totalScore > 0 ? '+' : ''}{manualScores.ollama.totalScore}
                      </div>
                    </div>
                  )}
                  
                  {manualScores.ollama.totalScore !== null && manualScores.traditional.totalScore !== null && (
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Winner</div>
                      <div className="text-2xl">
                        {manualScores.ollama.totalScore > manualScores.traditional.totalScore ? '🔥' :
                         manualScores.traditional.totalScore > manualScores.ollama.totalScore ? '⚡' : '🤝'}
                      </div>
                    </div>
                  )}
                  
                  {manualScores.traditional.totalScore !== null && (
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Traditional Total</div>
                      <div className={`text-2xl font-bold ${
                        manualScores.traditional.totalScore > 0 ? 'text-green-600' : 
                        manualScores.traditional.totalScore < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {manualScores.traditional.totalScore > 0 ? '+' : ''}{manualScores.traditional.totalScore}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
} 