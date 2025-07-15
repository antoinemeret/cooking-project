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
    const { tags } = body

    if (tags === undefined) {
      return NextResponse.json({ error: 'Tags field is required' }, { status: 400 })
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id },
      data: { tags },
      include: { ingredients: true }
    })

    // Add new tags to the canonical list
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