import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addTagToCanonicalList } from '@/lib/tag-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 })
    }

    const body = await request.json()
    const { title, rawIngredients, instructions, tags } = body

    // Build update data object with provided fields
    const updateData: any = {}
    
    if (title !== undefined) {
      updateData.title = title
    }
    
    if (rawIngredients !== undefined) {
      updateData.rawIngredients = JSON.stringify(rawIngredients)
    }
    
    if (instructions !== undefined) {
      updateData.instructions = instructions
    }
    
    if (tags !== undefined) {
      updateData.tags = tags
    }

    // Check if at least one field is provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one field must be provided' }, { status: 400 })
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: updateData,
      include: { ingredients: true }
    })

    // Add new tags to the canonical list if tags were updated
    if (tags) {
      try {
        const newTags = JSON.parse(tags)
        if (Array.isArray(newTags)) {
          for (const tag of newTags) {
            await addTagToCanonicalList(tag, 'default')
          }
        }
      } catch (error) {
        console.error('Error adding tags to canonical list:', error)
      }
    }

    return NextResponse.json({ recipe: updatedRecipe })
  } catch (error) {
    console.error('Error updating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 })
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: true }
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    )
  }
} 

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 })
    }

    const deleted = await prisma.recipe.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2025') {
      // Record not found
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }
    console.error('Error deleting recipe:', error)
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    )
  }
} 