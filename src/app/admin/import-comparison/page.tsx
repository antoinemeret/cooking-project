'use client'

import { useState, useEffect } from 'react'
import { ImportComparisonInterface } from '@/components/admin/ImportComparisonInterface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Settings, BarChart3, Lock } from 'lucide-react'
import Link from 'next/link'

export default function ImportComparisonPage() {
  const [showStats, setShowStats] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if admin access is already granted (simple localStorage check)
    const savedAuth = localStorage.getItem('admin_access')
    if (savedAuth === 'granted') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleAdminAuth = () => {
    // Simple admin key check for demo purposes
    // In production, this should be proper authentication
    const expectedKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'admin123'
    
    if (adminKey === expectedKey) {
      setIsAuthenticated(true)
      setError('')
      localStorage.setItem('admin_access', 'granted')
    } else {
      setError('Invalid admin key. Please contact the system administrator.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAdminKey('')
    localStorage.removeItem('admin_access')
  }

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-3 sm:p-4 max-w-md">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-sm space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
              <p className="text-sm text-muted-foreground">
                This feature requires administrative privileges
              </p>
            </div>

            {/* Authentication Form */}
            <div className="space-y-4">
              <div>
                <label htmlFor="admin-key" className="block text-sm font-medium mb-2">
                  Admin Key
                </label>
                <Input
                  id="admin-key"
                  type="password"
                  placeholder="Enter admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAdminAuth()
                    }
                  }}
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button 
                onClick={handleAdminAuth} 
                className="w-full"
                disabled={!adminKey.trim()}
              >
                Access Admin Panel
              </Button>
            </div>

            {/* Info */}
            <div className="text-center">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>

            {/* Dev Note */}
            <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">Development Note:</p>
              <p>For demo purposes, use admin key: <code className="bg-muted px-1 rounded">admin123</code></p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1">
              URL Import Comparison
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Compare Ollama vs Traditional parsing technologies side-by-side
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="hidden sm:flex"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleLogout}
            title="Logout"
            className="shrink-0"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Admin Notice */}
      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-amber-600 dark:text-amber-400 text-lg shrink-0">⚠️</div>
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Admin-Only Feature
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This comparison tool is for evaluating URL import technologies. 
              Results will help determine the optimal parsing approach for production use.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Panel (if enabled) */}
      {showStats && (
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-primary">0</div>
              <div className="text-muted-foreground">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-green-600">0%</div>
              <div className="text-muted-foreground">Ollama Success</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-blue-600">0%</div>
              <div className="text-muted-foreground">Traditional Success</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-purple-600">0ms</div>
              <div className="text-muted-foreground">Avg Speed</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Comparison Interface */}
      <ImportComparisonInterface />

      {/* Instructions Panel */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          How to Use
        </h3>
        <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
          <p>1. <strong>Enter a recipe URL</strong> in the input field above</p>
          <p>2. <strong>Click "Compare"</strong> to run both parsing approaches simultaneously</p>
          <p>3. <strong>Review the results</strong> side-by-side and evaluate quality</p>
          <p>4. <strong>Mark success/failure</strong> for each technology's output</p>
          <p>5. <strong>Check performance metrics</strong> to compare speed and accuracy</p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
        <p>
          This comparison feature is temporary and will be removed after technology evaluation is complete.
        </p>
      </div>
    </div>
  )
} 