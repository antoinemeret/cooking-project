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
  compact?: boolean
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

export function VideoProgressTracker({ progress, className, compact = false }: VideoProgressTrackerProps) {
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const getCurrentStepIndex = () => {
    if (progress.stage === 'error') return -1
    if (progress.stage === 'done') return PROCESSING_STEPS.length
    return PROCESSING_STEPS.findIndex(step => step.id === progress.stage)
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const currentStepIndex = getCurrentStepIndex()

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg", className)}>
        <div className="flex-shrink-0">
          {progress.stage === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : progress.stage === 'done' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-blue-900 truncate">
              {progress.message || PROCESSING_STEPS[currentStepIndex]?.label || 'Processing...'}
            </p>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {formatTime(elapsedTime)}
            </span>
          </div>
          {progress.platform && (
            <p className="text-xs text-blue-600 mt-0.5">
              {progress.platform} video
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Processing Video Recipe</h3>
          {progress.platform && (
            <p className="text-sm text-gray-600 mt-1">
              Extracting recipe from {progress.platform} video
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-gray-900">{formatTime(elapsedTime)}</div>
          <div className="text-xs text-gray-500">Elapsed time</div>
        </div>
      </div>

      {/* Error State */}
      {progress.stage === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Processing Failed</h4>
              <p className="text-sm text-red-600 mt-1">
                {progress.error || 'An error occurred while processing the video'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {progress.stage === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-800">Recipe Extracted Successfully!</h4>
              <p className="text-sm text-green-600 mt-1">
                Recipe has been processed and is ready for review
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="space-y-4">
        {PROCESSING_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex
          const isCompleted = index < currentStepIndex || progress.stage === 'done'
          const isFailed = progress.stage === 'error' && index <= currentStepIndex

          const IconComponent = step.icon

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-all duration-200",
                isActive && "bg-blue-50 border border-blue-200",
                isCompleted && !isFailed && "bg-green-50",
                isFailed && "bg-red-50"
              )}
            >
              {/* Step Icon */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                  isCompleted && !isFailed && "bg-green-500 border-green-500 text-white",
                  isActive && !isFailed && "bg-blue-500 border-blue-500 text-white",
                  isFailed && "bg-red-500 border-red-500 text-white",
                  !isActive && !isCompleted && !isFailed && "bg-gray-100 border-gray-300 text-gray-400"
                )}
              >
                {isFailed ? (
                  <AlertCircle className="h-5 w-5" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <IconComponent className="h-5 w-5" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={cn(
                      "font-medium",
                      isActive && "text-blue-900",
                      isCompleted && !isFailed && "text-green-800",
                      isFailed && "text-red-800",
                      !isActive && !isCompleted && !isFailed && "text-gray-600"
                    )}
                  >
                    {step.label}
                  </h4>
                  {isActive && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm mt-1",
                    isActive && "text-blue-700",
                    isCompleted && !isFailed && "text-green-600",
                    isFailed && "text-red-600",
                    !isActive && !isCompleted && !isFailed && "text-gray-500"
                  )}
                >
                  {isActive && progress.message ? progress.message : step.description}
                </p>
              </div>

              {/* Estimated Time */}
              <div
                className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  isCompleted && !isFailed && "bg-green-100 text-green-700",
                  isActive && "bg-blue-100 text-blue-700",
                  !isActive && !isCompleted && !isFailed && "bg-gray-100 text-gray-500"
                )}
              >
                {step.estimatedTime}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Message */}
      {progress.stage !== 'error' && progress.stage !== 'done' && (
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            <Clock className="h-4 w-4 inline mr-1" />
            Video processing typically takes 30-60 seconds depending on video length
          </p>
        </div>
      )}
    </div>
  )
} 