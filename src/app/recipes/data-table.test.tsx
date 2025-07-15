import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { DataTable } from './data-table'

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