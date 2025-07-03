import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  filterTagSuggestions, 
  findSimilarTags, 
  TagSuggestion 
} from '@/lib/tag-utils'

/**
 * GET /api/tags - Get tag suggestions based on user input and frequency
 * Query parameters:
 * - q: Search query (optional)
 * - limit: Maximum number of suggestions (default 10)
 * - threshold: Similarity threshold for suggestions (default 0.3)
 * - userId: User ID for personalized suggestions (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const threshold = parseFloat(searchParams.get('threshold') || '0.3')
    const userId = searchParams.get('userId')

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    if (threshold < 0 || threshold > 1) {
      return NextResponse.json(
        { error: 'Threshold must be between 0 and 1' },
        { status: 400 }
      )
    }

    // Get all recipes with tags to calculate frequency
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        tags: true
      },
      where: {
        tags: {
          not: {
            equals: "[]"
          }
        }
      }
    })

    // Build tag frequency map
    const tagFrequency = new Map<string, number>()
    
    recipes.forEach(recipe => {
      if (recipe.tags) {
        try {
          const parsedTags = JSON.parse(recipe.tags)
          if (Array.isArray(parsedTags)) {
            parsedTags.forEach(tag => {
              const normalizedTag = tag.toLowerCase().trim()
              if (normalizedTag) {
                tagFrequency.set(normalizedTag, (tagFrequency.get(normalizedTag) || 0) + 1)
              }
            })
          }
        } catch (error) {
          // Skip invalid JSON
          console.warn('Invalid tags JSON for recipe', recipe.id, recipe.tags)
        }
      }
    })

    // Convert to TagSuggestion array
    const allTags: TagSuggestion[] = Array.from(tagFrequency.entries()).map(([tag, frequency]) => ({
      tag,
      frequency
    }))

    // If user provided, get their specific tag usage for personalization
    let userTags: TagSuggestion[] = []
    if (userId) {
      const userRecipes = await prisma.recipe.findMany({
        select: {
          id: true,
          tags: true
        },
        where: {
          // Note: This assumes you have a userId field on recipes
          // If you don't have user-specific recipes, remove this filter
          tags: {
            not: {
              equals: "[]"
            }
          }
        }
      })

      const userTagFrequency = new Map<string, number>()
      userRecipes.forEach(recipe => {
        if (recipe.tags) {
          try {
            const parsedTags = JSON.parse(recipe.tags)
            if (Array.isArray(parsedTags)) {
              parsedTags.forEach(tag => {
                const normalizedTag = tag.toLowerCase().trim()
                if (normalizedTag) {
                  userTagFrequency.set(normalizedTag, (userTagFrequency.get(normalizedTag) || 0) + 1)
                }
              })
            }
          } catch (error) {
            // Skip invalid JSON
            console.warn('Invalid tags JSON for user recipe', recipe.id, recipe.tags)
          }
        }
      })

      userTags = Array.from(userTagFrequency.entries()).map(([tag, frequency]) => ({
        tag,
        frequency
      }))
    }

    // Use user-specific tags if available, otherwise use global tags
    const tagsToUse = userTags.length > 0 ? userTags : allTags

    let suggestions: TagSuggestion[] = []

    if (query.trim()) {
      // If query provided, find similar tags
      const similarTags = findSimilarTags(query, tagsToUse, threshold)
      
      // Also get filtered suggestions
      const filteredSuggestions = filterTagSuggestions(query, tagsToUse, limit)
      
      // Combine and deduplicate
      const combinedMap = new Map<string, TagSuggestion>()
      
      // Add similar tags first (higher priority)
      similarTags.forEach(tag => {
        combinedMap.set(tag.tag, tag)
      })
      
      // Add filtered suggestions
      filteredSuggestions.forEach(tag => {
        if (!combinedMap.has(tag.tag)) {
          combinedMap.set(tag.tag, tag)
        }
      })
      
      suggestions = Array.from(combinedMap.values())
        .sort((a, b) => {
          // Sort by similarity if available, then by frequency
          if (a.similarity !== undefined && b.similarity !== undefined) {
            return b.similarity - a.similarity
          }
          return b.frequency - a.frequency
        })
        .slice(0, limit)
    } else {
      // No query, return most frequent tags
      suggestions = filterTagSuggestions('', tagsToUse, limit)
    }

    // Format response
    const response = {
      suggestions: suggestions.map(tag => ({
        tag: tag.tag,
        frequency: tag.frequency,
        similarity: tag.similarity
      })),
      totalTags: allTags.length,
      query: query || null,
      limit,
      threshold
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching tag suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tag suggestions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tags - Track tag usage for frequency calculation
 * Body: { tags: string[], userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tags, userId, recipeId } = body

    // Validate request
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags array is required' },
        { status: 400 }
      )
    }

    if (!recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID is required for tag tracking' },
        { status: 400 }
      )
    }

    // Verify recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(recipeId) }
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    // Update recipe with new tags
    const filteredTags = tags.filter(tag => tag && tag.trim().length > 0)
    const updatedRecipe = await prisma.recipe.update({
      where: { id: parseInt(recipeId) },
      data: {
        tags: JSON.stringify(filteredTags)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Tags updated successfully',
      tags: JSON.parse(updatedRecipe.tags)
    })

  } catch (error) {
    console.error('Error tracking tag usage:', error)
    return NextResponse.json(
      { error: 'Failed to track tag usage' },
      { status: 500 }
    )
  }
} 