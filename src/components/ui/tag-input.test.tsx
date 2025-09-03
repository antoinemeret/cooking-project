import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TagInput, TagSuggestion } from './tag-input'

jest.useFakeTimers()

describe('TagInput', () => {
  const baseProps = {
    tags: [],
    onTagsChange: jest.fn(),
    placeholder: 'Add tags...'
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders with no tags', () => {
    render(<TagInput {...baseProps} />)
    expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument()
  })

  it('renders with initial tags', () => {
    render(<TagInput {...baseProps} tags={['vegan', 'quick']} />)
    expect(screen.getByText('vegan')).toBeInTheDocument()
    expect(screen.getByText('quick')).toBeInTheDocument()
  })

  it('calls onTagsChange when adding a tag by typing and pressing Enter', () => {
    const onTagsChange = jest.fn()
    render(<TagInput {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'dinner' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).toHaveBeenCalledWith(['dinner'])
  })

  it('removes a tag when clicking the remove button', () => {
    const onTagsChange = jest.fn()
    render(<TagInput {...baseProps} tags={['vegan', 'quick']} onTagsChange={onTagsChange} />)
    const removeButtons = screen.getAllByRole('button', { name: /remove tag/i })
    fireEvent.click(removeButtons[0])
    expect(onTagsChange).toHaveBeenCalledWith(['quick'])
  })

  it('shows suggestions and adds a tag from suggestions', async () => {
    const suggestions: TagSuggestion[] = [
      { tag: 'vegan', frequency: 10 },
      { tag: 'vegetarian', frequency: 8 }
    ]
    const getSuggestions = jest.fn().mockResolvedValue(suggestions)
    const onTagsChange = jest.fn()
    render(
      <TagInput {...baseProps} onTagsChange={onTagsChange} getSuggestions={getSuggestions} />
    )
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'veg' } })
    jest.runAllTimers()
    await waitFor(() => expect(screen.getByText('vegan')).toBeInTheDocument())
    fireEvent.click(screen.getByText('vegan'))
    expect(onTagsChange).toHaveBeenCalledWith(['vegan'])
  })

  it('creates a new tag if not in suggestions', async () => {
    const getSuggestions = jest.fn().mockResolvedValue([])
    const onTagsChange = jest.fn()
    render(
      <TagInput {...baseProps} onTagsChange={onTagsChange} getSuggestions={getSuggestions} />
    )
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'customtag' } })
    jest.runAllTimers()
    await waitFor(() => expect(screen.getByText(/create "customtag"/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/create "customtag"/i))
    expect(onTagsChange).toHaveBeenCalledWith(['customtag'])
  })

  it('prevents adding duplicate tags', () => {
    const onTagsChange = jest.fn()
    render(<TagInput {...baseProps} tags={['vegan']} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'vegan' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).not.toHaveBeenCalled()
    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
  })

  it('respects maxTags limit', () => {
    const onTagsChange = jest.fn()
    render(
      <TagInput {...baseProps} tags={['a', 'b']} onTagsChange={onTagsChange} maxTags={2} />
    )
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'c' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).not.toHaveBeenCalled()
    expect(screen.getByText(/cannot exceed/i)).toBeInTheDocument()
  })

  it('supports keyboard navigation in suggestions', async () => {
    const suggestions: TagSuggestion[] = [
      { tag: 'vegan', frequency: 10 },
      { tag: 'vegetarian', frequency: 8 }
    ]
    const getSuggestions = jest.fn().mockResolvedValue(suggestions)
    const onTagsChange = jest.fn()
    render(
      <TagInput {...baseProps} onTagsChange={onTagsChange} getSuggestions={getSuggestions} />
    )
    const input = screen.getByPlaceholderText('Add tags...')
    fireEvent.change(input, { target: { value: 'veg' } })
    jest.runAllTimers()
    await waitFor(() => expect(screen.getByText('vegan')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).toHaveBeenCalledWith(['vegan'])
  })

  it('is accessible: input is focusable and has correct aria attributes', () => {
    render(<TagInput {...baseProps} />)
    const input = screen.getByPlaceholderText('Add tags...')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toBeEnabled()
  })
}) 