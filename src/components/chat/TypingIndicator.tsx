import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  className?: string
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div className={cn(
      "flex w-full mb-4 justify-start",
      className
    )}>
      <div className="bg-muted text-muted-foreground mr-4 max-w-[80%] rounded-2xl px-4 py-3">
        <div className="flex items-center space-x-1">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
          </div>
          <span className="text-xs ml-2 opacity-70">AI is thinking...</span>
        </div>
      </div>
    </div>
  )
} 