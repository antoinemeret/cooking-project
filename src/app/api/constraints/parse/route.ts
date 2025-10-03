import { NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  ConstraintParseRequestSchema, 
  ConstraintParseResponseSchema, 
  PartialInterpretationSchema,
  ConstraintsSchema 
} from '@/lib/assistant/types'

// Mock Claude API client (replace with actual Claude integration)
const mockClaudeAPI = {
  async parseConstraints(transcript: string, language: string = 'fr') {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Mock parsing logic based on common patterns
    const lowerTranscript = transcript.toLowerCase()
    
    // Extract meal count
    const mealCountMatch = lowerTranscript.match(/(\d+)\s*(?:repas?|meals?)/i)
    const mealCount = mealCountMatch ? parseInt(mealCountMatch[1]) : 1
    
    // Extract ingredients
    const includeIngredients: string[] = []
    const excludeIngredients: string[] = []
    
    // Common ingredient patterns
    const ingredientPatterns = [
      'légumes', 'vegetables', 'tomates', 'tomatoes', 'carottes', 'carrots',
      'oignons', 'onions', 'ail', 'garlic', 'épinards', 'spinach',
      'champignons', 'mushrooms', 'courgettes', 'zucchini', 'aubergines', 'eggplant'
    ]
    
    ingredientPatterns.forEach(ingredient => {
      if (lowerTranscript.includes(ingredient)) {
        includeIngredients.push(ingredient)
      }
    })
    
    // Extract dietary restrictions
    const dietaryRestrictions: string[] = []
    if (lowerTranscript.includes('végétarien') || lowerTranscript.includes('vegetarian')) {
      dietaryRestrictions.push('vegetarian')
    }
    if (lowerTranscript.includes('vegan') || lowerTranscript.includes('végan')) {
      dietaryRestrictions.push('vegan')
    }
    if (lowerTranscript.includes('sans gluten') || lowerTranscript.includes('gluten-free')) {
      dietaryRestrictions.push('gluten-free')
    }
    if (lowerTranscript.includes('sans lactose') || lowerTranscript.includes('dairy-free')) {
      dietaryRestrictions.push('dairy-free')
    }
    
    // Extract cuisine style
    const cuisineStyle: string[] = []
    if (lowerTranscript.includes('italien') || lowerTranscript.includes('italian')) {
      cuisineStyle.push('italian')
    }
    if (lowerTranscript.includes('français') || lowerTranscript.includes('french')) {
      cuisineStyle.push('french')
    }
    if (lowerTranscript.includes('asiatique') || lowerTranscript.includes('asian')) {
      cuisineStyle.push('chinese')
    }
    
    // Extract dish types
    const dishType: string[] = []
    if (lowerTranscript.includes('plat principal') || lowerTranscript.includes('main course')) {
      dishType.push('main')
    }
    if (lowerTranscript.includes('entrée') || lowerTranscript.includes('appetizer')) {
      dishType.push('appetizer')
    }
    if (lowerTranscript.includes('dessert')) {
      dishType.push('dessert')
    }
    if (lowerTranscript.includes('salade') || lowerTranscript.includes('salad')) {
      dishType.push('salad')
    }
    
    // Extract time constraints
    const timeMatch = lowerTranscript.match(/(\d+)\s*(?:minutes?|mins?|heures?|hours?)/i)
    const maxTime = timeMatch ? parseInt(timeMatch[1]) : undefined
    
    // Extract seasonal preference
    const seasonal = lowerTranscript.includes('saison') || lowerTranscript.includes('seasonal')
    
    // Build constraints object
    const constraints = {
      general: {
        mealCount,
        seasonal
      },
      perMeal: [
        {
          mealIndex: 0,
          includeIngredients: includeIngredients.length > 0 ? includeIngredients : undefined,
          excludeIngredients: excludeIngredients.length > 0 ? excludeIngredients : undefined,
          dishType: dishType.length > 0 ? dishType : undefined,
          dietaryRestrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
          cuisineStyle: cuisineStyle.length > 0 ? cuisineStyle : undefined,
          maxPrepTime: maxTime,
          maxCookTime: maxTime
        }
      ],
      conflicts: []
    }
    
    // Generate interpretation
    const interpretation = `J'ai compris que vous voulez ${mealCount} repas${mealCount > 1 ? 's' : ''}${seasonal ? ' avec des ingrédients de saison' : ''}${includeIngredients.length > 0 ? ` incluant ${includeIngredients.join(', ')}` : ''}${dietaryRestrictions.length > 0 ? ` avec les restrictions ${dietaryRestrictions.join(', ')}` : ''}${cuisineStyle.length > 0 ? ` de style ${cuisineStyle.join(', ')}` : ''}${maxTime ? ` en moins de ${maxTime} minutes` : ''}.`
    
    // Calculate confidence based on extracted information
    const confidence = Math.min(0.9, 0.3 + (includeIngredients.length * 0.1) + (dietaryRestrictions.length * 0.15) + (cuisineStyle.length * 0.1) + (mealCount > 1 ? 0.1 : 0))
    
    return {
      constraints,
      interpretation,
      confidence,
      extractedValues: {
        mealCount,
        includeIngredients,
        dietaryRestrictions,
        cuisineStyle,
        dishType,
        maxTime,
        seasonal
      },
      language
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validate request
    const validationResult = ConstraintParseRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: validationResult.error.errors },
        { status: 400 }
      )
    }
    
    const { transcript, language } = validationResult.data
    
    // Parse constraints using Claude API
    const parseResult = await mockClaudeAPI.parseConstraints(transcript, language)
    
    // Validate the parsed constraints
    const constraintsValidation = ConstraintsSchema.safeParse(parseResult.constraints)
    
    if (constraintsValidation.success) {
      // Full parsing successful
      const response = {
        constraints: constraintsValidation.data,
        interpretation: parseResult.interpretation,
        confidence: parseResult.confidence,
        extractedValues: parseResult.extractedValues,
        language: parseResult.language
      }
      
      const responseValidation = ConstraintParseResponseSchema.safeParse(response)
      if (responseValidation.success) {
        return NextResponse.json(responseValidation.data, { status: 200 })
      } else {
        console.error('Response validation failed:', responseValidation.error)
        return NextResponse.json(
          { error: 'Failed to generate valid response' },
          { status: 500 }
        )
      }
    } else {
      // Partial parsing - return partial interpretation
      console.warn('Constraint parsing failed, returning partial interpretation:', constraintsValidation.error)
      
      const partialResponse = {
        constraints: parseResult.constraints,
        interpretation: parseResult.interpretation + ' (Certaines informations n\'ont pas pu être interprétées correctement)',
        confidence: Math.max(0.1, parseResult.confidence - 0.2),
        extractedValues: parseResult.extractedValues,
        language: parseResult.language,
        errors: constraintsValidation.error.errors.map(e => e.message)
      }
      
      const partialValidation = PartialInterpretationSchema.safeParse(partialResponse)
      if (partialValidation.success) {
        return NextResponse.json(partialValidation.data, { status: 200 })
      } else {
        console.error('Partial response validation failed:', partialValidation.error)
        return NextResponse.json(
          { error: 'Failed to generate partial interpretation' },
          { status: 500 }
        )
      }
    }
    
  } catch (error) {
    console.error('Constraint parsing API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error during constraint parsing' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
