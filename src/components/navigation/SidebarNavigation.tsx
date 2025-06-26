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

export function SidebarNavigation() {
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
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-40">
      <div className="flex flex-col h-full">
        {/* Logo/Header */}
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">🍳</span>
            <span className="text-xl font-bold">Recipe Assistant</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    "hover:bg-muted/50",
                    item.isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-lg" role="img" aria-label={item.label}>
                    {item.emoji}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            AI-powered meal planning
          </div>
        </div>
      </div>
    </aside>
  )
} 