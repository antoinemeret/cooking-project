import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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