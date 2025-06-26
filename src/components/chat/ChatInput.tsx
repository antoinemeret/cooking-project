import { useState, useRef, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Ask me about meal planning, recipes, or dietary preferences...",
  className 
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled || isLoading) return

    setIsLoading(true)
    setMessage("")
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await onSendMessage(trimmedMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  return (
    <div className={cn(
      "flex items-end space-x-2 p-4 border-t bg-background",
      className
    )}>
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[120px] resize-none pr-12"
          rows={1}
        />
        
        {/* Character count for long messages */}
        {message.length > 200 && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background px-1">
            {message.length}/500
          </div>
        )}
      </div>
      
      <Button
        onClick={handleSend}
        disabled={!message.trim() || disabled || isLoading}
        size="icon"
        className="h-11 w-11 flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
} 