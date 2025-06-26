import { cn } from "@/lib/utils"

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface MessageBubbleProps {
  message: Message
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  
  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start",
      className
    )}>
      <div className={cn(
        "max-w-[80%] md:max-w-[70%] rounded-2xl px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-sm md:text-base",
        isUser 
          ? "bg-primary text-primary-foreground ml-3 sm:ml-4" 
          : "bg-muted text-muted-foreground mr-3 sm:mr-4"
      )}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
        <div className={cn(
          "text-xs md:text-sm mt-2 opacity-70",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  )
} 