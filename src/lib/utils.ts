import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMonthName(month: number): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  return months[month - 1] || 'Unknown'
}

export function validateImageFile(file: File): { valid: boolean, error?: string } {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' }
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 5MB)' }
  }
  return { valid: true }
}

/**
 * Validates if a URL is safe for Next.js Image optimization
 * Checks if it's a valid absolute URL and matches allowed patterns
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false
  }
  
  // Check if it's a valid URL
  try {
    const urlObj = new URL(url)
    
    // Allow localhost for development
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      return true
    }
    
    // Allow Vercel Blob storage
    if (urlObj.hostname.includes('public.blob.vercel-storage.com')) {
      return true
    }
    
    // Allow GitHub raw content
    if (urlObj.hostname === 'raw.githubusercontent.com') {
      return true
    }
    
    // For relative paths starting with /, they're safe (local assets)
    if (url.startsWith('/')) {
      return true
    }
    
    // Reject other external URLs that aren't configured
    return false
  } catch {
    // If URL parsing fails, it might be a relative path
    // Relative paths starting with / are safe
    if (url.startsWith('/')) {
      return true
    }
    
    // Otherwise it's invalid
    return false
  }
}