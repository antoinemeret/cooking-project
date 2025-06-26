'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  emoji: string
  isActive?: boolean
}

export function BottomNavigation() {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      href: '/recipes',
      label: 'Recipes',
      emoji: '📖',
      isActive: pathname.startsWith('/recipes')
    },
    {
      href: '/assistant',
      label: 'Assistant',
      emoji: '💬',
      isActive: pathname.startsWith('/assistant')
    },
    {
      href: '/planner',
      label: 'Planner',
      emoji: '📋',
      isActive: pathname.startsWith('/planner')
    },
    {
      href: '/groceries',
      label: 'Groceries',
      emoji: '🛒',
      isActive: pathname.startsWith('/groceries')
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
              "min-h-[44px] min-w-[44px]", // Ensure minimum touch targets
              "hover:bg-muted/50 active:bg-muted",
              item.isActive
                ? "text-primary font-medium"
                : "text-muted-foreground"
            )}
          >
            <span className="text-lg" role="img" aria-label={item.label}>
              {item.emoji}
            </span>
            <span className="leading-none">{item.label}</span>
          </Link>
        ))}
      </div>
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-background" />
    </nav>
  )
} 