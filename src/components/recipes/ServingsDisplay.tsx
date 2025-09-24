'use client'

import { Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServingsDisplayProps {
  servings?: number | null
  className?: string
}

export function ServingsDisplay({ 
  servings = 4, 
  className 
}: ServingsDisplayProps) {
  return (
    <div className={cn(
      "bg-[#f1f1f1] rounded px-1 py-1 flex items-center gap-1",
      className
    )}>
      <Utensils className="h-3 w-3 text-[#757575]" />
      <span className="text-xs text-[#757575]">{servings}</span>
    </div>
  )
}
