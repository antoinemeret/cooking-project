'use client'

import { cn } from '@/lib/utils'

interface TimeDisplayProps {
  preparationTime?: number | null // in minutes
  cookingTime?: number | null // in minutes
  totalTime?: number // in minutes (if provided, will be used instead of prep + cooking)
  className?: string
}

// Icon URLs from Figma
const imgPreparationIcon = "http://localhost:3845/assets/4f62a481fcb893b0d1ede0b0061889b569a84a9a.svg"
const imgCookingIcon = "http://localhost:3845/assets/fefa99d42b12f5ec4b83d02f0584bf5b020faeb4.svg"

export function TimeDisplay({ 
  preparationTime, 
  cookingTime, 
  totalTime,
  className 
}: TimeDisplayProps) {
  // If totalTime is provided, use it; otherwise calculate from prep + cooking
  const displayTime = totalTime || ((preparationTime || 0) + (cookingTime || 0))
  
  // If we have both prep and cooking times, show them separately
  const showSeparateTimes = !totalTime && preparationTime && cookingTime

  return (
    <div className={cn(
      "bg-[#f1f1f1] box-border flex gap-1 items-center justify-center px-2 py-1 relative rounded-[4px] w-fit",
      className
    )}>
      {showSeparateTimes ? (
        <>
          {/* Preparation Time */}
          <div className="flex items-center justify-start relative shrink-0">
            <div className="relative shrink-0 size-4">
              <img alt="" className="block max-w-none size-full" src={imgPreparationIcon} />
            </div>
            <div className="font-['Public_Sans:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#757575] text-[12px] text-nowrap">
              <p className="leading-[18px] whitespace-pre"> ~{preparationTime} min</p>
            </div>
          </div>
          
          {/* Separator */}
          <div className="font-['Public_Sans:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#757575] text-[12px] text-nowrap">
            <p className="leading-[18px] whitespace-pre">|</p>
          </div>
          
          {/* Cooking Time */}
          <div className="flex items-center justify-start relative shrink-0">
            <div className="relative shrink-0 size-4">
              <img alt="" className="block max-w-none size-full" src={imgCookingIcon} />
            </div>
            <div className="font-['Public_Sans:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#757575] text-[12px] text-nowrap">
              <p className="leading-[18px] whitespace-pre">~{cookingTime} min</p>
            </div>
          </div>
        </>
      ) : (
        <div className="content-stretch flex items-center justify-start relative shrink-0">
          <div className="relative shrink-0 size-4">
            <img alt="" className="block max-w-none size-full" src={imgCookingIcon} />
          </div>
          <div className="font-['Public_Sans:Regular',_sans-serif] font-normal leading-[0] relative shrink-0 text-[#757575] text-[12px] text-nowrap">
            <p className="leading-[18px] whitespace-pre">~{displayTime} min</p>
          </div>
        </div>
      )}
    </div>
  )
}
