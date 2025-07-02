"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, AlertCircle, Loader2, Video, Download, Mic, Brain } from 'lucide-react'

export type VideoProcessingStage = 'analyzing' | 'downloading' | 'transcribing' | 'structuring' | 'done' | 'error'

export interface VideoProcessingProgress {
  stage: VideoProcessingStage
  message?: string
  timestamp?: number
  platform?: string
  error?: string
}

interface VideoProgressTrackerProps {
  progress: VideoProcessingProgress
  className?: string
}

interface ProcessingStep {
  id: VideoProcessingStage
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  estimatedTime: string
}

const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'analyzing',
    label: 'Analyzing Video',
    description: 'Validating URL and platform compatibility',
    icon: Video,
    estimatedTime: '~1s'
  },
  {
    id: 'downloading', 
    label: 'Extracting Audio',
    description: 'Downloading video and extracting audio content',
    icon: Download,
    estimatedTime: '~5s'
  },
  {
    id: 'transcribing',
    label: 'Speech Recognition',
    description: 'Converting speech to text using AI',
    icon: Mic,
    estimatedTime: '~10s'
  },
  {
    id: 'structuring',
    label: 'Recipe Extraction',
    description: 'Structuring recipe from transcription',
    icon: Brain,
    estimatedTime: '~25s'
  }
]

export function VideoProgressTracker({ progress, className }: VideoProgressTrackerProps) {
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  // Info box style, always compact
  return (
    <div className={cn(
      'flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg',
      className
    )}>
      <div className="flex-shrink-0">
        {progress.stage === 'error' ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : progress.stage === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-blue-800">
          {progress.stage === 'error'
            ? (progress.error || 'Processing failed')
            : progress.stage === 'done'
            ? 'Recipe extracted successfully'
            : progress.message || 'Processing video...'}
        </span>
        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
          {formatTime(elapsedTime)}
        </span>
      </div>
    </div>
  )
} 