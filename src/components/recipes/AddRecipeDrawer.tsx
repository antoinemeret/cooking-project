'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { SquarePen, Link, Camera } from 'lucide-react'

interface AddRecipeDrawerProps {
  children: React.ReactNode
  onManualAdd?: () => void
  onLinkAdd?: () => void
  onPhotoAdd?: () => void
}

export function AddRecipeDrawer({
  children,
  onManualAdd,
  onLinkAdd,
  onPhotoAdd
}: AddRecipeDrawerProps) {
  const [open, setOpen] = useState(false)

  const handleOptionClick = (option: string) => {
    console.log(`📱 Drawer option clicked: ${option}`)
    switch (option) {
      case 'manual':
        console.log('📱 Calling onManualAdd')
        onManualAdd?.()
        break
      case 'link':
        console.log('📱 Calling onLinkAdd')
        onLinkAdd?.()
        break
      case 'photo':
        console.log('📱 Calling onPhotoAdd')
        onPhotoAdd?.()
        break
    }
    // Close the drawer after action
    setOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="h-[269px]">
        {/* Title */}
        <div className="px-[26px] pt-8">
          <h2 className="font-medium text-[#212b36] text-[18px] leading-[27px]">
            Ajouter une nouvelle recette
          </h2>
        </div>

        {/* Three Options */}
        <div className="px-[26px] pt-6 pb-6">
          <div className="flex gap-8 items-center justify-start">
            {/* Manual Option */}
            <div className="flex flex-col gap-3 items-center justify-start w-[92px]">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOptionClick('manual')
                }}
                className="bg-[#f3f3f3] h-[92px] w-full rounded-[8px] flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <SquarePen className="w-8 h-8 text-[#212b36]" />
              </button>
              <span className="font-normal text-[#212b36] text-[12px] leading-[18px] text-center w-full">
                Manuellement
              </span>
            </div>

            {/* Link Option */}
            <div className="flex flex-col gap-3 items-center justify-start w-[92px]">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOptionClick('link')
                }}
                className="bg-[#f3f3f3] h-[92px] w-full rounded-[8px] flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <Link className="w-8 h-8 text-[#212b36]" />
              </button>
              <span className="font-normal text-[#212b36] text-[12px] leading-[18px] text-center w-full">
                Blog ou video
              </span>
            </div>

            {/* Photo Option */}
            <div className="flex flex-col gap-3 items-center justify-start w-[92px]">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOptionClick('photo')
                }}
                className="bg-[#f3f3f3] h-[92px] w-full rounded-[8px] flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <Camera className="w-8 h-8 text-[#212b36]" />
              </button>
              <span className="font-normal text-[#212b36] text-[12px] leading-[18px] text-center w-full">
                Photo
              </span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
