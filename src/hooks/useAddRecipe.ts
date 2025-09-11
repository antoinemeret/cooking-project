'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { toast } from 'sonner'

export function useAddRecipe() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [isUrlInputDialogOpen, setIsUrlInputDialogOpen] = useState(false)
  const [importUrl, setImportUrl] = useState("")
  const [importError, setImportError] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState("Add new")
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleManualAdd = () => {
    setIsImportDialogOpen(true)
    setIsManualMode(true)
  }

  const handleLinkAdd = () => {
    setIsUrlInputDialogOpen(true)
  }

  const handlePhotoAdd = () => {
    photoInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportStatus("Uploading...")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const result = await response.json()
      if (result.success) {
        toast.success("Recipe imported successfully!")
        // Trigger a refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('recipeAdded'))
      } else {
        throw new Error(result.error || "Import failed")
      }
    } catch (error) {
      console.error("Photo import error:", error)
      toast.error("Failed to import recipe from photo")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  const handleUrlSubmit = async () => {
    if (!importUrl.trim()) {
      setImportError("Please enter a URL")
      return
    }

    setIsImporting(true)
    setImportError("")
    setImportStatus("Processing URL...")

    try {
      const response = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: importUrl }),
      })

      if (!response.ok) {
        throw new Error("URL import failed")
      }

      const result = await response.json()
      if (result.success) {
        toast.success("Recipe imported successfully!")
        setIsUrlInputDialogOpen(false)
        setImportUrl("")
        // Trigger a refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('recipeAdded'))
      } else {
        throw new Error(result.error || "Import failed")
      }
    } catch (error) {
      console.error("URL import error:", error)
      setImportError("Failed to import recipe from URL")
    } finally {
      setIsImporting(false)
      setImportStatus("Add new")
    }
  }

  return {
    // State
    isImportDialogOpen,
    setIsImportDialogOpen,
    isManualMode,
    setIsManualMode,
    isUrlInputDialogOpen,
    setIsUrlInputDialogOpen,
    importUrl,
    setImportUrl,
    importError,
    setImportError,
    isImporting,
    importStatus,
    photoInputRef,
    
    // Handlers
    handleManualAdd,
    handleLinkAdd,
    handlePhotoAdd,
    handleFileChange,
    handleUrlSubmit,
  }
}
