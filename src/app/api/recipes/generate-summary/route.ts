import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function generateSummaryWithLLM(instructions: any) {
  const prompt = `
  You are a helpful assistant that summarizes recipe instructions in French.
  
  Summarize the following recipe instructions in French, using **absolutely no more than 25 words**.  
  This is a hard limit : less than 25 words.

  Output only the summary — no explanations.

  Instructions:
  """
  ${instructions}
  """
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
  return output
}

export async function POST(req: any) {
  try {
    const { recipeId } = await req.json()
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
    if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    const summary = await generateSummaryWithLLM(recipe.instructions)
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: { summary }
    })

    return NextResponse.json({ recipe: updatedRecipe })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
} 