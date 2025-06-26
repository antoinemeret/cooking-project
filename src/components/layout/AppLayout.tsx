'use client'

import { BottomNavigation } from '@/components/navigation/BottomNavigation'
import { SidebarNavigation } from '@/components/navigation/SidebarNavigation'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar navigation for desktop */}
      <div className="hidden lg:block">
        <SidebarNavigation />
      </div>
      
      {/* Main content area */}
      <main className={cn(
        "min-h-screen",
        // Mobile: bottom padding for bottom navigation + safe area
        "pb-16 lg:pb-0 pb-safe",
        // Desktop: left margin for sidebar
        "lg:ml-64"
      )}>
        {children}
      </main>
      
      {/* Bottom navigation for mobile */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  )
} 