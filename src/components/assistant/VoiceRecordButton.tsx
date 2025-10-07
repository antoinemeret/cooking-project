import React, { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAssistantStore, useAssistantState } from '@/lib/assistant/state'
import { Mic, Square } from 'lucide-react'

type VoiceRecordButtonProps = {
  className?: string
  disabled?: boolean
}

function getLabel (state: string, isRecording: boolean) {
  if (state === 'processing' || state === 'interpreting') return "Traitement..."
  return isRecording ? 'Arrêter' : 'Enregistrer'
}

export function VoiceRecordButton ({ className = '', disabled = false }: VoiceRecordButtonProps) {
  const state = useAssistantState()
  const isRecording = useAssistantStore(state => state.isRecording)
  const { startRecording, stopRecording, setTranscriptionResult, setError, setState, setInterpretation } = useAssistantStore()
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [uiRecording, setUiRecording] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasTranscribedRef = useRef(false)

  const isProcessing = state === 'processing' || state === 'interpreting'
  const isDisabled = disabled || isProcessing || isProcessingAudio
  const showRecording = uiRecording || isRecording

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
    }
  }, [mediaRecorder])

  // Start recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0)
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 60 seconds
          if (newTime >= 60) {
            handleStopRecording()
            return 60
          }
          return newTime
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRecording])

  const handleStartRecording = async () => {
    if (isProcessingAudio) return // Prevent multiple recordings

    // Optimistically switch UI to recording immediately for instant feedback
    console.log('[VoiceRecordButton] startRecording() clicked')
    startRecording()
    setUiRecording(true)
    console.log('[VoiceRecordButton] startRecording() called, checking state after...')
    // Check state after a brief delay to see if it updated
    setTimeout(() => {
      const currentState = useAssistantStore.getState()
      console.log('[VoiceRecordButton] State after startRecording:', {
        isRecording: currentState.isRecording,
        currentState: currentState.currentState
      })
    }, 100)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      const chunks: Blob[] = []
      hasTranscribedRef.current = false
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        if (hasTranscribedRef.current) return
        hasTranscribedRef.current = true
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        
        // Check file size (max 5MB)
        if (audioBlob.size > 5 * 1024 * 1024) {
          setError('Fichier audio trop volumineux. Veuillez raccourcir votre enregistrement.')
          return
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        
        // Send to transcription API
        setIsProcessingAudio(true)
        await transcribeAudio(audioBlob)
      }

      recorder.onerror = (event) => {
        console.error('Recording error:', event)
        setError('Erreur lors de l\'enregistrement. Veuillez réessayer.')
        stream.getTracks().forEach(track => track.stop())
      }

      setMediaRecorder(recorder)
      setAudioChunks(chunks)
      recorder.start(1000) // Collect data every second
        } catch (error) {
          console.error('Error accessing microphone:', error)
          setError('Impossible d\'accéder au microphone. Vérifiez les permissions.')
        // Revert to idle if we failed to start recording
        setState('idle')
        setIsProcessingAudio(false)
        setUiRecording(false)
        }
  }

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    stopRecording()
    setUiRecording(false)
  }

  const transcribeAudio = async (audioBlob: Blob, retryCount = 0) => {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second base delay
    
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

          const result = await response.json()
          setTranscriptionResult(result)

          // Immediately parse constraints to guarantee the second request happens
          try {
            const parseRes = await fetch('/api/constraints/parse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: result.transcript, language: 'fr' })
            })
            if (parseRes.ok) {
              const parsed = await parseRes.json()
              // Store interpretation; page flow will pick it up
              // @ts-ignore runtime type checked server-side
              setInterpretation(parsed)
            } else {
              console.error('Constraint parse HTTP error:', parseRes.status)
            }
          } catch (e) {
            console.error('Constraint parse error:', e)
          }

          setIsProcessingAudio(false)
        } catch (error) {
      console.error('Transcription error:', error)
      
      // Check if we should retry
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff
        console.log(`Retrying transcription in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
        
        // Show retry message to user
        setError(`Tentative ${retryCount + 1}/${maxRetries} - Nouvelle tentative dans ${delay/1000}s...`)
        
        setTimeout(() => {
          transcribeAudio(audioBlob, retryCount + 1)
        }, delay)
      } else {
        // All retries failed
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          setError('Erreur de connexion. Vérifiez votre connexion internet et réessayez.')
        } else if (error instanceof Error && error.message.includes('HTTP error! status: 429')) {
          setError('Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.')
        } else if (error instanceof Error && error.message.includes('HTTP error! status: 413')) {
          setError('Fichier audio trop volumineux. Veuillez raccourcir votre enregistrement.')
            } else {
              setError('Erreur lors de la transcription. Veuillez réessayer.')
            }
            setIsProcessingAudio(false)
          }
        }
      }

  const handleClick = () => {
    console.log('[VoiceRecordButton] handleClick', { isDisabled, isRecording, isProcessingAudio, state })
    if (isDisabled) return
    if (showRecording) {
      handleStopRecording()
      return
    }
    handleStartRecording()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <Button
        size='lg'
        className={`relative w-48 h-48 rounded-full text-base font-medium ${
          showRecording
            ? 'bg-gradient-to-br from-green-500 to-blue-500 text-white shadow-lg'
            : 'bg-muted text-foreground'
        } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        onClick={handleClick}
        disabled={isDisabled}
      >
        <div className='absolute inset-0 rounded-full flex items-center justify-center'>
          {showRecording ? (
            <Square className='w-10 h-10' />
          ) : (
            <Mic className='w-10 h-10' />
          )}
        </div>
        <span className='sr-only'>{getLabel(state, isRecording)}</span>
        {/* Visual pulse when recording */}
        {showRecording && (
          <span className='absolute inset-0 rounded-full animate-pulse bg-white/10' />
        )}
      </Button>
      
      {/* Intentionally no extra text/timer; button transformation communicates recording */}
    </div>
  )
}
