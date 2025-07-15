import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { DataTable } from './data-table'
import { toast } from 'sonner'

// Mock the TagInput component to avoid complex dependencies
jest.mock('@/components/ui/tag-input', () => ({
  TagInput: ({ tags, onTagsChange, placeholder }: any) => (
    <div data-testid="tag-input">
      <input
        data-testid="tag-input-field"
        placeholder={placeholder}
        onChange={(e) => {
          if (e.target.value.includes(',')) {
            const newTag = e.target.value.replace(',', '').trim()
            if (newTag) {
              onTagsChange([...tags, newTag])
            }
          }
        }}
      />
      <div data-testid="current-tags">
        {tags.map((tag: string, index: number) => (
          <span key={index} data-testid={`tag-${tag}`}>
            {tag}
            <button
              data-testid={`remove-${tag}`}
              onClick={() => onTagsChange(tags.filter((_: string, i: number) => i !== index))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  ),
  TagSuggestion: {}
}))

// Mock other dependencies
jest.mock('@/lib/video-url-detector', () => ({
  detectVideoUrl: jest.fn(() => ({ isVideoUrl: false })),
  getPlatformDisplayName: jest.fn(() => 'Test Platform')
}))

jest.mock('@/components/recipes/VideoProgressTracker', () => ({
  VideoProgressTracker: () => <div data-testid="video-progress">Video Progress</div>
}))

// Mock fetch for API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock toast for success notifications
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}))

describe('DataTable TagInput Integration', () => {
  const mockRecipes: any[] = []
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders TagInput in manual recipe creation mode', async () => {
    render(<DataTable recipes={mockRecipes} onRefresh={mockOnRefresh} loading={false} />)
    
    // Open the import dialog
    const addButton = screen.getByText('Add new')
    fireEvent.click(addButton)
    
    // Click "Create manually"
    const createManually = screen.getByText('Create manually')
    fireEvent.click(createManually)
    
    // Check that TagInput is rendered
    await waitFor(() => {
      expect(screen.getByTestId('tag-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Add tags like/)).toBeInTheDocument()
    })
  })

  it('allows adding and removing tags in the form', async () => {
    render(<DataTable recipes={mockRecipes} onRefresh={mockOnRefresh} loading={false} />)
    
    // Open manual creation dialog
    const addButton = screen.getByText('Add new')
    fireEvent.click(addButton)
    const createManually = screen.getByText('Create manually')
    fireEvent.click(createManually)
    
    // Add a tag
    const tagInput = screen.getByTestId('tag-input-field')
    fireEvent.change(tagInput, { target: { value: 'vegan,' } })
    
    // Check that tag was added
    await waitFor(() => {
      expect(screen.getByTestId('tag-vegan')).toBeInTheDocument()
    })
    
    // Remove the tag
    const removeButton = screen.getByTestId('remove-vegan')
    fireEvent.click(removeButton)
    
    // Check that tag was removed
    await waitFor(() => {
      expect(screen.queryByTestId('tag-vegan')).not.toBeInTheDocument()
    })
  })
}) 

describe('Sheet Edit/Delete Controls', () => {
  const mockRecipe = {
    id: 1,
    title: 'Test Recipe',
    summary: 'Test summary',
    instructions: 'Test instructions',
    rawIngredients: '["ingredient 1", "ingredient 2"]',
    tags: '[]',
    startSeason: 1,
    endSeason: 12,
    grade: 3,
    time: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: []
  }
  const mockOnRefresh = jest.fn()

  it('shows always-visible edit and delete buttons in the sheet header', async () => {
    render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
    // Open the sheet by clicking the recipe title button (not the header)
    const recipeTitleButtons = screen.getAllByText('Test Recipe')
    // The clickable button is the first one
    fireEvent.click(recipeTitleButtons[0])
    // Wait for the sheet dialog to open
    const sheetDialog = await screen.findByRole('dialog')
    // Check for edit button in the dialog
    const editBtn = within(sheetDialog).getByLabelText('Edit Recipe')
    expect(editBtn).toBeInTheDocument()
    // Check for delete button in the dialog
    const deleteBtn = within(sheetDialog).getByLabelText('Delete Recipe')
    expect(deleteBtn).toBeInTheDocument()
    // Both should be visible and next to each other
    const header = editBtn.closest('.flex')
    expect(header).toContainElement(editBtn)
    expect(header).toContainElement(deleteBtn)
  })
}) 

describe('Recipe Save Functionality (Task 3.5)', () => {
  const mockRecipe = {
    id: 1,
    title: 'Test Recipe',
    summary: 'Test summary',
    instructions: 'Test instructions',
    rawIngredients: '["ingredient 1", "ingredient 2"]',
    tags: '[]',
    startSeason: 1,
    endSeason: 12,
    grade: 3,
    time: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: []
  }
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    ;(toast.success as jest.Mock).mockClear()
  })

  describe('Optimistic UI Updates', () => {
    it('optimistically updates the UI when save is successful', async () => {
      const updatedRecipe = {
        ...mockRecipe,
        title: 'Updated Recipe Title',
        instructions: 'Updated instructions'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: updatedRecipe })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Update the title
      const titleInput = screen.getByDisplayValue('Test Recipe')
      fireEvent.change(titleInput, { target: { value: 'Updated Recipe Title' } })
      
      // Update instructions
      const instructionsTextarea = screen.getByDisplayValue('Test instructions')
      fireEvent.change(instructionsTextarea, { target: { value: 'Updated instructions' } })
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify API call was made with correct data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Updated Recipe Title',
            rawIngredients: ['ingredient 1', 'ingredient 2'],
            instructions: 'Updated instructions'
          })
        })
      })
      
      // Verify onRefresh was called to update the list
      expect(mockOnRefresh).toHaveBeenCalled()
    })

    it('shows loading state during save operation', async () => {
      // Mock a slow API response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ 
            ok: true, 
            json: () => Promise.resolve({ recipe: mockRecipe }) 
          }), 100)
        )
      )

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify loading state is shown
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
      
      // Verify button is disabled during save
      expect(screen.getByText('Saving...')).toBeDisabled()
    })
  })

  describe('Toast Feedback', () => {
    it('shows success toast when save is successful', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: mockRecipe })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify success toast was shown
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Changes saved')
      })
    })
  })

  describe('Error Alert Feedback', () => {
    it('shows error alert when save fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to update recipe' })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify error alert is shown
      await waitFor(() => {
        expect(screen.getByText('Failed to update recipe')).toBeInTheDocument()
      })
      
      // Verify alert has destructive styling
      const alert = screen.getByText('Failed to update recipe').closest('[role="alert"]')
      expect(alert).toHaveClass('text-destructive')
    })

    it('shows generic error message when API response is malformed', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify generic error message is shown
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('clears error when entering edit mode again', async () => {
      // First, trigger an error
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to update recipe' })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save to trigger error
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify error is shown
      await waitFor(() => {
        expect(screen.getByText('Failed to update recipe')).toBeInTheDocument()
      })
      
      // Exit edit mode
      const closeBtn = screen.getByLabelText('Close Edit Mode')
      fireEvent.click(closeBtn)
      
      // Re-enter edit mode
      fireEvent.click(editBtn)
      
      // Verify error is cleared
      await waitFor(() => {
        expect(screen.queryByText('Failed to update recipe')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify error is shown and onRefresh is not called
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
      
      expect(mockOnRefresh).not.toHaveBeenCalled()
    })

    it('handles API errors with specific error messages', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid recipe data' })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify specific error message is shown
      await waitFor(() => {
        expect(screen.getByText('Invalid recipe data')).toBeInTheDocument()
      })
    })

    it('handles malformed API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify fallback error message is shown
      await waitFor(() => {
        expect(screen.getByText('Failed to save recipe')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation and Data Processing', () => {
    it('filters empty lines from ingredients when saving', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: mockRecipe })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Update ingredients with empty lines
      const ingredientsTextarea = screen.getByDisplayValue('ingredient 1\ningredient 2')
      fireEvent.change(ingredientsTextarea, { 
        target: { value: 'ingredient 1\n\n  \ningredient 2\n' } 
      })
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify only non-empty ingredients are sent
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test Recipe',
            rawIngredients: ['ingredient 1', 'ingredient 2'],
            instructions: 'Test instructions'
          })
        })
      })
    })

    it('preserves whitespace in instructions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipe: mockRecipe })
      })

      render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
      
      // Open sheet and enter edit mode
      const recipeTitle = screen.getByText('Test Recipe')
      fireEvent.click(recipeTitle)
      
      const editBtn = await waitFor(() => screen.getByLabelText('Edit Recipe'))
      fireEvent.click(editBtn)
      
      // Update instructions with whitespace
      const instructionsTextarea = screen.getByDisplayValue('Test instructions')
      fireEvent.change(instructionsTextarea, { 
        target: { value: 'Step 1\n\nStep 2\n  Step 2.1' } 
      })
      
      // Save the changes
      const saveBtn = screen.getByText('Save')
      fireEvent.click(saveBtn)
      
      // Verify whitespace is preserved
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test Recipe',
            rawIngredients: ['ingredient 1', 'ingredient 2'],
            instructions: 'Step 1\n\nStep 2\n  Step 2.1'
          })
        })
      })
    })
  })
}) 

describe('Recipe Delete Flow (Task 4.4)', () => {
  const mockRecipe = {
    id: 1,
    title: 'Test Recipe',
    summary: 'Test summary',
    instructions: 'Test instructions',
    rawIngredients: '["ingredient 1", "ingredient 2"]',
    tags: '[]',
    startSeason: 1,
    endSeason: 12,
    grade: 3,
    time: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: []
  }
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  it('opens confirmation dialog when Delete is clicked', async () => {
    render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
    const recipeTitle = screen.getByText('Test Recipe')
    fireEvent.click(recipeTitle)
    const deleteBtn = await waitFor(() => screen.getByLabelText('Delete Recipe'))
    fireEvent.click(deleteBtn)
    expect(await screen.findByText('Delete Recipe')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this recipe? This action cannot be undone.')).toBeInTheDocument()
  })

  it('calls API, closes dialog and sheet, and refreshes table on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
    render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
    const recipeTitle = screen.getByText('Test Recipe')
    fireEvent.click(recipeTitle)
    const deleteBtn = await waitFor(() => screen.getByLabelText('Delete Recipe'))
    fireEvent.click(deleteBtn)
    const confirmBtn = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/recipes/1', { method: 'DELETE' })
      expect(mockOnRefresh).toHaveBeenCalled()
      // Dialog and sheet should close (recipe title button should be visible again)
      expect(screen.getByText('Test Recipe')).toBeInTheDocument()
    })
  })

  it('shows error alert if API fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Failed to delete recipe' }) })
    render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
    const recipeTitle = screen.getByText('Test Recipe')
    fireEvent.click(recipeTitle)
    const deleteBtn = await waitFor(() => screen.getByLabelText('Delete Recipe'))
    fireEvent.click(deleteBtn)
    const confirmBtn = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(screen.getByText('Failed to delete recipe')).toBeInTheDocument()
    })
  })

  it('shows loading state and disables buttons while deleting', async () => {
    let resolveDelete: any
    mockFetch.mockImplementation(() => new Promise(resolve => { resolveDelete = resolve }))
    render(<DataTable recipes={[mockRecipe]} onRefresh={mockOnRefresh} loading={false} />)
    const recipeTitle = screen.getByText('Test Recipe')
    fireEvent.click(recipeTitle)
    const deleteBtn = await waitFor(() => screen.getByLabelText('Delete Recipe'))
    fireEvent.click(deleteBtn)
    const confirmBtn = await screen.findByRole('button', { name: /delete/i })
    fireEvent.click(confirmBtn)
    // Button should show 'Deleting...' and be disabled
    expect(screen.getByText('Deleting...')).toBeDisabled()
    expect(screen.getByText('Cancel')).toBeDisabled()
    // Finish the API call
    resolveDelete({ ok: true, json: () => Promise.resolve({ success: true }) })
  })
}) 