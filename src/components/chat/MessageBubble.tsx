'use client'

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

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
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.3,
        ease: "easeOut"
      }}
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm transition-all duration-200 hover:shadow-md",
          isUser
            ? "bg-primary text-primary-foreground ml-4"
            : "bg-muted text-muted-foreground mr-4"
        )}
      >
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <p className={cn(
          "text-xs mt-1 opacity-70",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </p>
      </div>
    </motion.div>
  )
} 