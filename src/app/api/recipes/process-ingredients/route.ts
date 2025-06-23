import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function processIngredientsWithLLM(rawIngredients: string[]) {
  const prompt = `
  You are a smart cooking assistant.

  Your task is to extract the **main ingredients** from the list below, ignoring all condiments, spices, herbs, seasonings, oils, and salt.

  Return only the cleaned list of ingredient names in JSON format (no quantities, no units, no comments, and no condiments).

  Here is an example of the input and output:

  Example Input:
  [
    "500 grammes de poivron ( rouge/vert/jaune )",
    "500 grammes de tomate ( mûres )",
    "1 gousse d'ail",
    "1/2 oignon",
    "3 c. à s. d'huile d'olive",
    "4 oeufs",
    "1 c. à c. de sel, cumin, paprika, poivre, piment, tabasco",
    "1 c. à c. de coriandre, aneth et/ou autre"
  ]

  Example Output:
  [
  "poivron",
  "tomate",
  "ail",
  "oignon",
  "oeufs"
  ]


  Ingredients to process:
  ${JSON.stringify(rawIngredients)}
  `

  let output = ''
  const provider = process.env.LLM_PROVIDER || 'ollama'
  if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3:8b',
        prompt,
        stream: false
      })
    })
    const data = await res.json()
    output = data.response || ''
  } else {
    const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    })
    const data = await res.json()
    output = data?.[0]?.generated_text || data?.generated_text || ''
  }

  // Extract all JSON arrays from the LLM output
  const allMatches = [...output.matchAll(/\[[\s\S]*?\]/g)]
  // console.log('All array matches:', allMatches.map(m => m[0]))

  // Use the last array found (often the cleaned list)
  const match = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null

  if (!match) return []

  try {
    return JSON.parse(match[0])
  } catch {
    console.log('Error parsing JSON')
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const { recipeId } = await req.json()
    if (!recipeId) {
      return NextResponse.json({ error: "No recipe ID provided" }, { status: 400 })
    }

    // Get the recipe with raw ingredients
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    })

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    // Parse raw ingredients
    const rawIngredients = JSON.parse(recipe.rawIngredients || '[]')
    
    // console.log('Raw ingredients', rawIngredients)

    // Process through LLM
    const cleanIngredients = await processIngredientsWithLLM(rawIngredients)

    //console.log('Clean ingredients', cleanIngredients)

    // Create or connect ingredients
    const ingredientConnectOrCreate = cleanIngredients.map((name: string) => ({
      where: { name },
      create: { name, startSeason: 1, endSeason: 12 }
    }))

    // console.log('Ingredient connect or create', ingredientConnectOrCreate)

    // Update recipe with processed ingredients
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        ingredients: {
          set: [], // Clear existing connections
          connectOrCreate: ingredientConnectOrCreate
        },
        rawIngredients: JSON.stringify(rawIngredients)
      },
      include: { ingredients: true }
    })

    // console.log('Calling process-ingredients', updatedRecipe.id)

    return NextResponse.json({ recipe: updatedRecipe })
  } catch (err) {
    console.error('Error processing ingredients:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
} 