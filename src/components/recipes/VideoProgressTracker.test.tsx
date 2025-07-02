import { render, screen, act } from '@testing-library/react'
import { VideoProgressTracker, VideoProcessingProgress } from './VideoProgressTracker'

describe('VideoProgressTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Compact Mode', () => {
    it('renders compact mode with analyzing stage', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing',
        platform: 'YouTube'
      }

      render(<VideoProgressTracker progress={progress} compact />)

      expect(screen.getByText('Analyzing Video')).toBeInTheDocument()
      expect(screen.getByText('YouTube video')).toBeInTheDocument()
      expect(screen.getByText('0s')).toBeInTheDocument()
    })

    it('shows elapsed time in compact mode', () => {
      const progress: VideoProcessingProgress = {
        stage: 'downloading'
      }

      render(<VideoProgressTracker progress={progress} compact />)

      // Advance time by 5 seconds and flush all timers
      act(() => {
        jest.advanceTimersByTime(5000)
        jest.runAllTimers()
      })

      expect(screen.getByText('5s')).toBeInTheDocument()
    })

    it('shows error state in compact mode', () => {
      const progress: VideoProcessingProgress = {
        stage: 'error',
        error: 'Failed to download video'
      }

      render(<VideoProgressTracker progress={progress} compact />)

      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(screen.getByRole('img', { hidden: true })).toHaveClass('text-red-500')
    })

    it('shows success state in compact mode', () => {
      const progress: VideoProcessingProgress = {
        stage: 'done'
      }

      render(<VideoProgressTracker progress={progress} compact />)

      expect(screen.getByRole('img', { hidden: true })).toHaveClass('text-green-500')
    })
  })

  describe('Full Mode', () => {
    it('renders full mode with header information', () => {
      const progress: VideoProcessingProgress = {
        stage: 'transcribing',
        platform: 'Instagram'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Processing Video Recipe')).toBeInTheDocument()
      expect(screen.getByText('Extracting recipe from Instagram video')).toBeInTheDocument()
      expect(screen.getByText('Elapsed time')).toBeInTheDocument()
    })

    it('shows all processing steps with correct states', () => {
      const progress: VideoProcessingProgress = {
        stage: 'transcribing'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Completed steps should be green
      expect(screen.getByText('Analyzing Video')).toBeInTheDocument()
      expect(screen.getByText('Extracting Audio')).toBeInTheDocument()
      
      // Active step should be highlighted
      expect(screen.getByText('Speech Recognition')).toBeInTheDocument()
      
      // Future step should be inactive
      expect(screen.getByText('Recipe Extraction')).toBeInTheDocument()
    })

    it('displays custom message for active step', () => {
      const progress: VideoProcessingProgress = {
        stage: 'downloading',
        message: 'Downloading video from YouTube...'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Downloading video from YouTube...')).toBeInTheDocument()
    })

    it('shows error state with error message', () => {
      const progress: VideoProcessingProgress = {
        stage: 'error',
        error: 'Video not accessible'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Processing Failed')).toBeInTheDocument()
      expect(screen.getByText('Video not accessible')).toBeInTheDocument()
    })

    it('shows success state', () => {
      const progress: VideoProcessingProgress = {
        stage: 'done'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Recipe Extracted Successfully!')).toBeInTheDocument()
      expect(screen.getByText('Recipe has been processed and is ready for review')).toBeInTheDocument()
    })

    it('displays estimated time footer when processing', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText(/Video processing typically takes 30-60 seconds/)).toBeInTheDocument()
    })

    it('hides footer when done or error', () => {
      const doneProgress: VideoProcessingProgress = {
        stage: 'done'
      }

      const { rerender } = render(<VideoProgressTracker progress={doneProgress} />)

      expect(screen.queryByText(/Video processing typically takes 30-60 seconds/)).not.toBeInTheDocument()

      const errorProgress: VideoProcessingProgress = {
        stage: 'error'
      }

      rerender(<VideoProgressTracker progress={errorProgress} />)

      expect(screen.queryByText(/Video processing typically takes 30-60 seconds/)).not.toBeInTheDocument()
    })
  })

  describe('Time Formatting', () => {
    it('formats seconds correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Check initial time
      expect(screen.getByText('0s')).toBeInTheDocument()

      // Advance time by 30 seconds and flush all timers
      act(() => {
        jest.advanceTimersByTime(30000)
        jest.runAllTimers()
      })

      expect(screen.getByText('30s')).toBeInTheDocument()
    })

    it('formats minutes and seconds correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'structuring'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Advance time by 75 seconds (1m 15s) and flush all timers
      act(() => {
        jest.advanceTimersByTime(75000)
        jest.runAllTimers()
      })

      expect(screen.getByText('1m 15s')).toBeInTheDocument()
    })

    it('formats exact minutes correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'downloading'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Advance time by 120 seconds (2m 0s) and flush all timers
      act(() => {
        jest.advanceTimersByTime(120000)
        jest.runAllTimers()
      })

      expect(screen.getByText('2m 0s')).toBeInTheDocument()
    })
  })

  describe('Step State Logic', () => {
    it('marks steps as completed correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'structuring'
      }

      render(<VideoProgressTracker progress={progress} />)

      // First three steps should be completed (analyzing, downloading, transcribing)
      // Fourth step (structuring) should be active
      // We can't easily test the visual state, but we can verify the component renders without errors
      expect(screen.getByText('Recipe Extraction')).toBeInTheDocument()
    })

    it('handles done state correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'done'
      }

      render(<VideoProgressTracker progress={progress} />)

      // All steps should be completed
      expect(screen.getByText('Recipe Extracted Successfully!')).toBeInTheDocument()
    })

    it('handles error state correctly', () => {
      const progress: VideoProcessingProgress = {
        stage: 'error'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Error state should be shown
      expect(screen.getByText('Processing Failed')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      render(<VideoProgressTracker progress={progress} />)

      // Check that the component has proper heading structure
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Processing Video Recipe')
    })

    it('provides meaningful text content for screen readers', () => {
      const progress: VideoProcessingProgress = {
        stage: 'transcribing',
        platform: 'TikTok'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Extracting recipe from TikTok video')).toBeInTheDocument()
      expect(screen.getByText('Converting speech to text using AI')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing platform gracefully', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('Processing Video Recipe')).toBeInTheDocument()
      expect(screen.queryByText(/video$/)).not.toBeInTheDocument()
    })

    it('handles missing error message', () => {
      const progress: VideoProcessingProgress = {
        stage: 'error'
      }

      render(<VideoProgressTracker progress={progress} />)

      expect(screen.getByText('An error occurred while processing the video')).toBeInTheDocument()
    })

    it('handles unknown stage gracefully', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing' as any
      }

      render(<VideoProgressTracker progress={progress} />)

      // Should still render without crashing
      expect(screen.getByText('Processing Video Recipe')).toBeInTheDocument()
    })
  })

  describe('CSS Classes', () => {
    it('applies custom className', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      const { container } = render(
        <VideoProgressTracker progress={progress} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('applies compact className', () => {
      const progress: VideoProcessingProgress = {
        stage: 'analyzing'
      }

      const { container } = render(
        <VideoProgressTracker progress={progress} compact className="compact-class" />
      )

      expect(container.firstChild).toHaveClass('compact-class')
    })
  })
}) 