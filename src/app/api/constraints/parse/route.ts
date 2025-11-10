import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  ConstraintParseRequestSchema,
  ConstraintParseResponseSchema,
  PartialInterpretationSchema,
  ConstraintsSchema
} from '@/lib/assistant/types'

// Minimal, robust mock parser to avoid build/runtime syntax errors
async function mockParseConstraints (transcript: string, language: string = 'fr') {
  await new Promise(resolve => setTimeout(resolve, 200))

  const lower = transcript.toLowerCase()

  // 1) Detect explicit overall totals (e.g., "3 plats", "trois recettes").
  //    Use the maximum explicit number if multiple mentioned.
  const digitMatches = Array.from(lower.matchAll(/(\d+)\s*(?:repas|recettes?|plats?|meals?|recipes?)/g))
  const explicitFromDigits = digitMatches
    .map(m => parseInt(m[1], 10))
    .filter(n => !Number.isNaN(n) && n >= 2) // treat >=2 as explicit total

  let mealCount = explicitFromDigits.length ? Math.max(...explicitFromDigits) : NaN

  if (Number.isNaN(mealCount) || mealCount < 1) {
    const words = {
      // fr
      'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
      'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
      // en
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    } as Record<string, number>

    // Explicit words (>= 2) before plural nouns
    const wordKeys = Object.keys(words).join('|')
    const explicitWordRegex = new RegExp(`\\b(${wordKeys})\\b\\s*(?:repas|recettes|plats|meals|recipes)`, 'g')
    const wordMatches = Array.from(lower.matchAll(explicitWordRegex))
    const explicitWordNumbers = wordMatches
      .map(m => words[m[1]])
      .filter(n => n >= 2)
    if (explicitWordNumbers.length) {
      mealCount = Math.max(...explicitWordNumbers)
    }
  }

  // 2) If no explicit total, infer count from enumerated single-meal clauses like
  //    "un repas", "un plat", "une recette".
  if (Number.isNaN(mealCount) || mealCount < 1) {
    const singleMealRegex = /\b(?:un|une|1|one)\s*(?:repas|plat|recette|meal|recipe)\b/g
    const singles = Array.from(lower.matchAll(singleMealRegex)).length
    if (singles > 0) mealCount = singles
  }

  if (Number.isNaN(mealCount) || mealCount < 1) mealCount = 1

  const includeIngredients: string[] = []
  const known = ['aubergines', 'tomates', 'courgettes', 'poulet']
  known.forEach(k => { if (lower.includes(k)) includeIngredients.push(k) })

  const seasonal = lower.includes('saison')

  // Per-meal extraction by scanning clauses separated by commas/"et"
  type MealDetail = {
    includeIngredients?: string[]
    cookingMethod?: string[]
    dietaryRestrictions?: string[]
    excludeIngredients?: string[]
    cuisineStyle?: string[]
    dishType?: string[]
  }
  const mealDetails: MealDetail[] = []
  const clauses = lower
    .split(/[,;]+|\bet\b/g)
    .map(s => s.trim())
    .filter(Boolean)

  clauses.forEach(clause => {
    // Identify only clauses explicitly referring to a meal (repas/plat/recette)
    if (!/(?:^|\s)(?:un|une|1|one)\s*(?:repas|plat|recette)?\b/.test(clause)) return

    const detail: MealDetail = {}

    // Ingredient: "avec X" / "avec des X" — avoid capturing filler words and "cuisson"
    if (!/\bcuisson\b/.test(clause)) {
      const ingMatch = clause.match(/avec\s+(?:des?|du|de|de\sla|de\sl'|de\sle)?\s*([a-zàâçéèêëîïôûùüÿ\-]+)/)
      const stopwords = new Set(['un','une','du','de','des','la','le','les','l','au','aux','cuisson','legumes','légumes','vegetables'])
      const ing = ingMatch && ingMatch[1] ? ingMatch[1].trim() : ''
      if (ing && !stopwords.has(ing)) detail.includeIngredients = [ing]
    }

    // Cooking method: oven, pan/poêle
    if (/cuisson au four|\bau four\b/.test(clause)) {
      detail.cookingMethod = ['oven']
    }
    if (/cuisson\s+(?:a|à)\s+la\s+po(?:e|é)le|\b(?:a|à)\s+la\s+po(?:e|é)le\b/.test(clause)) {
      detail.cookingMethod = [...(detail.cookingMethod || []), 'fry']
    }

    // Dietary restriction: vegetarian
    if (/végétarien|vegetarian/.test(clause)) detail.dietaryRestrictions = ['vegetarian']

    // Exclude ingredients: "sans X" (map oeuf/œuf -> egg)
    const sansMatch = clause.match(/sans\s+(?:les?|des?)?\s*([a-zàâçéèêëîïôûùüÿœ\-]+)s?/)
    if (sansMatch) {
      let ex = sansMatch[1]
      if (/^oeuf|œuf$/.test(ex)) ex = 'oeufs'
      detail.excludeIngredients = [ex]
    }

    // Cuisine style: italien
    if (/\brepas\s+italien\b|\bitalien(ne)?\b/.test(clause)) {
      detail.cuisineStyle = ['italian']
    }

    // Dish type heuristic: tarte → treat as main; infer vegetarian if mentions vegetables and no meat keywords
    if (/\btarte\b/.test(clause)) {
      detail.dishType = ['main']
      const mentionsVeg = /\blégumes\b|\blegumes\b|\bvegetables\b/.test(clause)
      const meatWords = /(boeuf|bœuf|poulet|porc|lard|jambon|viande|steak|agneau|dinde|saumon|thon|poisson)/
      if (mentionsVeg && !meatWords.test(clause)) {
        detail.dietaryRestrictions = Array.from(new Set([...(detail.dietaryRestrictions || []), 'vegetarian']))
      }
    }

    mealDetails.push(detail)
  })

  // Build perMeal array
  const perMeal = mealDetails.length
    ? mealDetails.map((d, idx) => ({ mealIndex: idx, ...d }))
    : [
        {
          mealIndex: 0,
          includeIngredients: includeIngredients.length ? includeIngredients : undefined
        }
      ]

  // If mealCount > detected perMeal items, pad with empty placeholders
  while (perMeal.length < mealCount) {
    perMeal.push({ mealIndex: perMeal.length })
  }

  const constraints = {
    general: { mealCount, seasonal },
    perMeal,
    conflicts: [] as string[]
  }

  const listed = mealDetails
    .map(d => (d.includeIngredients && d.includeIngredients[0]) || (d.cookingMethod && d.cookingMethod[0]) || (d.dietaryRestrictions && d.dietaryRestrictions[0]))
    .filter(Boolean)
    .join(', ') || includeIngredients.join(', ')
  const interpretation = `J'ai compris que vous voulez ${mealCount} repas${mealCount > 1 ? 's' : ''}` +
    `${seasonal ? ' avec des ingrédients de saison' : ''}` +
    `${listed ? ' incluant ' + listed : ''}.`

  return {
    constraints,
    interpretation,
    confidence: 0.75,
    extractedValues: { mealCount, includeIngredients, seasonal },
    language
  }
}

export async function POST (req: Request) {
  try {
    const body = await req.json()

    const validation = ConstraintParseRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { transcript, language } = validation.data

    // Use mock for now (stable and fast). Swap to real LLM later.
    const result = await mockParseConstraints(transcript, language)

    const constraintsCheck = ConstraintsSchema.safeParse(result.constraints)
    if (constraintsCheck.success) {
      const response = {
        constraints: constraintsCheck.data,
        interpretation: result.interpretation,
        confidence: result.confidence,
        extractedValues: result.extractedValues,
        language: result.language
      }
      const validated = ConstraintParseResponseSchema.safeParse(response)
      if (validated.success) return NextResponse.json(validated.data, { status: 200 })
    }

    const partial = {
      constraints: result.constraints,
      interpretation: result.interpretation,
      confidence: result.confidence,
      extractedValues: result.extractedValues,
      language: result.language,
      errors: ['Partial validation']
    }
    const partialOk = PartialInterpretationSchema.safeParse(partial)
    if (partialOk.success) return NextResponse.json(partialOk.data, { status: 200 })

    return NextResponse.json({ error: 'Failed to parse constraints' }, { status: 500 })
  } catch (error) {
    console.error('Constraint parsing API error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error during constraint parsing' }, { status: 500 })
  }
}

export async function GET () {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
