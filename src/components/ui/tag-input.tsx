"use client"

import * as React from "react"
import { X, Plus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { Input } from "./input"
import { Button } from "./button"
import { validateTag, normalizeTag } from "@/lib/tag-utils"

export interface TagSuggestion {
  tag: string
  frequency: number
  similarity?: number
}

export interface TagInputProps {
  /** Current tags */
  tags: string[]
  /** Callback when tags change */
  onTagsChange: (tags: string[]) => void
  /** Placeholder text for the input */
  placeholder?: string
  /** Maximum number of tags allowed */
  maxTags?: number
  /** Function to fetch tag suggestions */
  getSuggestions?: (query: string) => Promise<TagSuggestion[]> | TagSuggestion[]
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether to show the add button for creating new tags */
  allowCreate?: boolean
  /** Custom validation function */
  onValidate?: (tag: string, existingTags: string[]) => { isValid: boolean; error?: string }
  /** Callback when dropdown open state changes */
  onDropdownOpenChange?: (open: boolean) => void
}

export const TagInput = React.forwardRef<HTMLDivElement, TagInputProps>(
  ({
    tags = [],
    onTagsChange,
    placeholder = "Add tags...",
    maxTags = 100,
    getSuggestions,
    disabled = false,
    className,
    allowCreate = true,
    onValidate,
    onDropdownOpenChange,
    ...props
  }, ref) => {
    const [inputValue, setInputValue] = React.useState("")
    const [suggestions, setSuggestions] = React.useState<TagSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const [selectedIndex, setSelectedIndex] = React.useState(-1)
    const [error, setError] = React.useState<string | null>(null)
    const [isLoading, setIsLoading] = React.useState(false)

    const inputRef = React.useRef<HTMLInputElement>(null)
    const suggestionsRef = React.useRef<HTMLDivElement>(null)

    // Fetch suggestions when input changes
    React.useEffect(() => {
      const fetchSuggestions = async () => {
        if (!inputValue.trim() || !getSuggestions) {
          setSuggestions([])
          setShowSuggestions(false)
          if (onDropdownOpenChange) onDropdownOpenChange(false)
          return
        }

        setIsLoading(true)
        try {
          const result = await getSuggestions(inputValue.trim())
          const filteredSuggestions = Array.isArray(result) 
            ? result.filter(suggestion => 
                !tags.some(tag => normalizeTag(tag) === normalizeTag(suggestion.tag))
              )
            : []
          
          setSuggestions(filteredSuggestions)
          setShowSuggestions(filteredSuggestions.length > 0)
          if (onDropdownOpenChange) onDropdownOpenChange(filteredSuggestions.length > 0)
          setSelectedIndex(-1)
        } catch (error) {
          console.warn('Failed to fetch tag suggestions:', error)
          setSuggestions([])
          setShowSuggestions(false)
          if (onDropdownOpenChange) onDropdownOpenChange(false)
        } finally {
          setIsLoading(false)
        }
      }

      const debounceTimeout = setTimeout(fetchSuggestions, 150)
      return () => clearTimeout(debounceTimeout)
    }, [inputValue, getSuggestions, tags])

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)
      setError(null)
      
      // Hide suggestions if input is empty
      if (!value.trim()) {
        setShowSuggestions(false)
        setSuggestions([])
        if (onDropdownOpenChange) onDropdownOpenChange(false)
      }
    }

    // Validate a tag
    const validateTagInput = (tag: string): { isValid: boolean; error?: string } => {
      if (onValidate) {
        return onValidate(tag, tags)
      }
      return validateTag(tag, tags)
    }

    // Add a tag
    const addTag = (tagToAdd: string) => {
      const trimmedTag = tagToAdd.trim()
      if (!trimmedTag) return

      // Check max tags limit
      if (tags.length >= maxTags) {
        setError(`Cannot exceed ${maxTags} tags`)
        return
      }

      // Validate the tag
      const validation = validateTagInput(trimmedTag)
      if (!validation.isValid) {
        setError(validation.error || 'Invalid tag')
        return
      }

      // Add the normalized tag
      const normalizedTag = normalizeTag(trimmedTag)
      const newTags = [...tags, normalizedTag]
      onTagsChange(newTags)
      
      // Clear input and hide suggestions
      setInputValue("")
      setShowSuggestions(false)
      setSuggestions([])
      setSelectedIndex(-1)
      setError(null)
      
      // Focus back to input
      inputRef.current?.focus()
    }

    // Remove a tag
    const removeTag = (indexToRemove: number) => {
      const newTags = tags.filter((_, index) => index !== indexToRemove)
      onTagsChange(newTags)
      inputRef.current?.focus()
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case "Enter":
          e.preventDefault()
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            addTag(suggestions[selectedIndex].tag)
          } else if (inputValue.trim() && allowCreate) {
            addTag(inputValue.trim())
          }
          break

        case "Escape":
          setShowSuggestions(false)
          setSelectedIndex(-1)
          setError(null)
          break

        case "ArrowDown":
          e.preventDefault()
          if (showSuggestions) {
            setSelectedIndex(prev => 
              prev < suggestions.length - 1 ? prev + 1 : 0
            )
          }
          break

        case "ArrowUp":
          e.preventDefault()
          if (showSuggestions) {
            setSelectedIndex(prev => 
              prev > 0 ? prev - 1 : suggestions.length - 1
            )
          }
          break

        case "Backspace":
          if (!inputValue && tags.length > 0) {
            removeTag(tags.length - 1)
          }
          break

        case "Tab":
          if (showSuggestions && selectedIndex >= 0) {
            e.preventDefault()
            addTag(suggestions[selectedIndex].tag)
          }
          break

        case ",":
        case ";":
          e.preventDefault()
          if (inputValue.trim()) {
            addTag(inputValue.trim())
          }
          break
      }
    }

    // Handle suggestion click
    const handleSuggestionClick = (suggestion: TagSuggestion) => {
      addTag(suggestion.tag)
    }

    // Handle create new tag
    const handleCreateNew = () => {
      if (inputValue.trim() && allowCreate) {
        addTag(inputValue.trim())
      }
    }

    // Handle input focus
    const handleInputFocus = () => {
      if (suggestions.length > 0) {
        setShowSuggestions(true)
        if (onDropdownOpenChange) onDropdownOpenChange(true)
      }
    }

    // Handle click outside to close suggestions
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(event.target as Node) &&
          !inputRef.current?.contains(event.target as Node)
        ) {
          setShowSuggestions(false)
          setSelectedIndex(-1)
          if (onDropdownOpenChange) onDropdownOpenChange(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Check if we should show "create new" option
    const showCreateNew = allowCreate && 
      inputValue.trim() && 
      !suggestions.some(s => normalizeTag(s.tag) === normalizeTag(inputValue.trim()))

    return (
      <div ref={ref} className={cn("relative w-full", className)} {...props}>
        {/* Main input container */}
        <div
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow]",
            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            error && "border-destructive ring-destructive/20",
            disabled && "pointer-events-none opacity-50",
            "md:text-sm"
          )}
        >
          {/* Existing tags */}
          {tags.map((tag, index) => (
            <Badge
              key={`${tag}-${index}`}
              variant="secondary"
              className={cn(
                "max-w-40 truncate text-xs font-medium",
                !disabled && "group cursor-default"
              )}
            >
              <span className="truncate">{tag}</span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-3 ml-1 shrink-0 rounded-full p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeTag(index)}
                  tabIndex={-1}
                >
                  <X className="size-2" />
                  <span className="sr-only">Remove tag</span>
                </Button>
              )}
            </Badge>
          ))}

          {/* Input field */}
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            placeholder={tags.length === 0 ? placeholder : ""}
            disabled={disabled}
            className="flex-1 min-w-20 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:border-transparent"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}

        {/* Suggestions dropdown (inline, below input) */}
        {showSuggestions && (suggestions.length > 0 || showCreateNew) && (
          <div
            ref={suggestionsRef}
            className={cn(
              "absolute top-full left-0 z-50 mt-1 w-full min-w-40 rounded-md border border-input bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 max-h-56 overflow-y-auto"
            )}
          >
            {isLoading && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Loading suggestions...
              </div>
            )}

            {/* Existing tag suggestions */}
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.tag}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  selectedIndex === index && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <span className="truncate">{suggestion.tag}</span>
                {suggestion.frequency > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {suggestion.frequency}
                  </span>
                )}
              </div>
            ))}

            {/* Create new tag option */}
            {showCreateNew && (
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  selectedIndex === suggestions.length && "bg-accent text-accent-foreground"
                )}
                onClick={handleCreateNew}
              >
                <Plus className="size-3" />
                <span className="truncate">Create "{inputValue.trim()}"</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

TagInput.displayName = "TagInput" 