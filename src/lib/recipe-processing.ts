import { prisma } from '@/lib/prisma'

/**
 * Generate summary from recipe instructions using LLM
 */
export async function generateSummaryWithLLM(instructions: string): Promise<string> {
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
  // Default to anthropic if ANTHROPIC_API_KEY is set, otherwise ollama (for local dev)
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')
  console.log(`🤖 Using LLM provider: ${provider}`)
  
  try {
    if (provider === 'anthropic') {
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set')
      }
      console.log(`🤖 Calling Anthropic Claude API`)
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey,
      })
      
      const responseStartTime = Date.now()
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
      const responseTime = Date.now() - responseStartTime
      console.log(`🤖 Anthropic API call took ${responseTime}ms`)
      
      const content = response.content[0]
      if (content.type === 'text') {
        output = content.text
        console.log(`🤖 Anthropic response received, length: ${output.length}`)
      } else {
        throw new Error('Unexpected response format from Anthropic')
      }
    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434'
      console.log(`🤖 Calling Ollama at ${ollamaUrl}/api/generate`)
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:8b',
          prompt,
          stream: false
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`❌ Ollama API error (${res.status}):`, errorText)
        throw new Error(`Ollama API error: ${res.status} ${errorText}`)
      }
      
      const data = await res.json()
      output = data.response || ''
      console.log(`🤖 Ollama response received, length: ${output.length}`)
    } else {
      const hfApiKey = process.env.HF_API_KEY
      if (!hfApiKey) {
        throw new Error('HF_API_KEY environment variable is not set')
      }
      console.log(`🤖 Calling HuggingFace API`)
      const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      })
      
      if (!res.ok) {
        const errorData = await res.text()
        console.error(`❌ HuggingFace API error (${res.status}):`, errorData)
        throw new Error(`HuggingFace API error: ${res.status} ${errorData}`)
      }
      
      const data = await res.json()
      output = data?.[0]?.generated_text || data?.generated_text || ''
      console.log(`🤖 HuggingFace response received, length: ${output.length}`)
    }
  } catch (error) {
    console.error(`❌ Error calling LLM for summary:`, error)
    throw error
  }
  
  const trimmed = output.trim()
  if (!trimmed) {
    console.warn(`⚠️ LLM returned empty response for summary`)
  }
  return trimmed
}

/**
 * Generate summary for a recipe and update it in the database
 */
export async function generateAndSaveSummary(recipeId: number): Promise<void> {
  console.log(`📝 Starting summary generation for recipe ${recipeId}`)
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
    if (!recipe) {
      console.error(`❌ Recipe ${recipeId} not found`)
      return
    }
    if (!recipe.instructions) {
      console.error(`❌ Recipe ${recipeId} has no instructions`)
      return
    }

    console.log(`📝 Generating summary for recipe ${recipeId} with ${recipe.instructions.length} chars of instructions`)
    const summary = await generateSummaryWithLLM(recipe.instructions)
    if (summary) {
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { summary }
      })
      console.log(`✅ Generated and saved summary for recipe ${recipeId}: "${summary.substring(0, 50)}..."`)
    } else {
      console.warn(`⚠️ No summary generated for recipe ${recipeId}`)
    }
  } catch (err) {
    console.error(`❌ Error generating summary for recipe ${recipeId}:`, err)
    throw err
  }
}

/**
 * Process ingredients from raw ingredients list using LLM
 */
export async function processIngredientsWithLLM(rawIngredients: string[]): Promise<string[]> {
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
  // Default to anthropic if ANTHROPIC_API_KEY is set, otherwise ollama (for local dev)
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')
  console.log(`🤖 Using LLM provider: ${provider}`)
  
  try {
    if (provider === 'anthropic') {
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set')
      }
      console.log(`🤖 Calling Anthropic Claude API`)
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey,
      })
      
      const responseStartTime = Date.now()
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
      const responseTime = Date.now() - responseStartTime
      console.log(`🤖 Anthropic API call took ${responseTime}ms`)
      
      const content = response.content[0]
      if (content.type === 'text') {
        output = content.text
        console.log(`🤖 Anthropic response received, length: ${output.length}`)
        if (output) {
          console.log(`🤖 Anthropic response preview: ${output.substring(0, 200)}...`)
        }
      } else {
        throw new Error('Unexpected response format from Anthropic')
      }
    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434'
      console.log(`🤖 Calling Ollama at ${ollamaUrl}/api/generate`)
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:8b',
          prompt,
          stream: false
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`❌ Ollama API error (${res.status}):`, errorText)
        throw new Error(`Ollama API error: ${res.status} ${errorText}`)
      }
      
      const data = await res.json()
      output = data.response || ''
      console.log(`🤖 Ollama response received, length: ${output.length}`)
      if (output) {
        console.log(`🤖 Ollama response preview: ${output.substring(0, 200)}...`)
      }
    } else {
      const hfApiKey = process.env.HF_API_KEY
      if (!hfApiKey) {
        throw new Error('HF_API_KEY environment variable is not set')
      }
      console.log(`🤖 Calling HuggingFace API`)
      const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      })
      
      if (!res.ok) {
        const errorData = await res.text()
        console.error(`❌ HuggingFace API error (${res.status}):`, errorData)
        throw new Error(`HuggingFace API error: ${res.status} ${errorData}`)
      }
      
      const data = await res.json()
      output = data?.[0]?.generated_text || data?.generated_text || ''
      console.log(`🤖 HuggingFace response received, length: ${output.length}`)
      if (output) {
        console.log(`🤖 HuggingFace response preview: ${output.substring(0, 200)}...`)
      }
    }
  } catch (error) {
    console.error(`❌ Error calling LLM for ingredients:`, error)
    throw error
  }

  if (!output.trim()) {
    console.warn(`⚠️ LLM returned empty response for ingredients`)
    return []
  }

  // Extract all JSON arrays from the LLM output
  const allMatches = [...output.matchAll(/\[[\s\S]*?\]/g)]
  console.log(`🔍 Found ${allMatches.length} JSON array matches in LLM response`)

  // Use the last array found (often the cleaned list)
  const match = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null

  if (!match) {
    console.warn(`⚠️ No JSON array found in LLM response. Full response: ${output.substring(0, 500)}`)
    return []
  }

  try {
    const parsed = JSON.parse(match[0])
    console.log(`✅ Parsed ${parsed.length} ingredients:`, parsed)
    return parsed
  } catch (parseError) {
    console.error(`❌ Error parsing JSON from LLM response:`, parseError)
    console.error(`Problematic JSON string: ${match[0]}`)
    return []
  }
}

/**
 * Process ingredients for a recipe and update it in the database
 */
export async function processAndSaveIngredients(recipeId: number): Promise<void> {
  console.log(`🥕 Starting ingredient processing for recipe ${recipeId}`)
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    })
    if (!recipe) {
      console.error(`❌ Recipe ${recipeId} not found`)
      return
    }

    // Parse raw ingredients
    let rawIngredients: string[] = []
    try {
      rawIngredients = JSON.parse(recipe.rawIngredients || '[]')
    } catch (err) {
      console.error(`❌ Error parsing rawIngredients for recipe ${recipeId}:`, err)
      return
    }

    if (rawIngredients.length === 0) {
      console.log(`⚠️ Recipe ${recipeId} has no raw ingredients to process`)
      return
    }

    console.log(`🥕 Processing ${rawIngredients.length} raw ingredients for recipe ${recipeId}`)
    // Process through LLM
    const llmStartTime = Date.now()
    const cleanIngredients = await processIngredientsWithLLM(rawIngredients)
    const llmTime = Date.now() - llmStartTime
    console.log(`🥕 LLM ingredient processing took ${llmTime}ms`)
    
    if (cleanIngredients.length === 0) {
      console.warn(`⚠️ No clean ingredients extracted for recipe ${recipeId}`)
      return
    }

    console.log(`🥕 Extracted ${cleanIngredients.length} clean ingredients: ${cleanIngredients.join(', ')}`)

    // Use Prisma's connectOrCreate to atomically handle ingredient creation/connection
    // This is much more reliable than manual retry logic and handles race conditions at the DB level
    const dbStartTime = Date.now()
    
    // Prepare connectOrCreate operations for all ingredients
    const ingredientConnectOrCreate = cleanIngredients.map((name: string) => ({
      where: { name },
      create: { name, startSeason: 1, endSeason: 12 }
    }))
    
    console.log(`🔗 Linking ${cleanIngredients.length} ingredients to recipe ${recipeId} using connectOrCreate...`)
    
    // Update recipe: use connectOrCreate to atomically connect existing or create new ingredients
    // This handles race conditions at the database level, avoiding unique constraint errors
    let updatedRecipe
    try {
      updatedRecipe = await prisma.recipe.update({
        where: { id: recipeId },
        data: {
          ingredients: {
            set: [], // Clear existing connections first
            connectOrCreate: ingredientConnectOrCreate
          }
        },
        include: {
          ingredients: {
            select: { id: true, name: true }
          }
        }
      })
    } catch (updateError: any) {
      // Check if error is due to unique constraint on id (sequence out of sync)
      // This can happen when connectOrCreate tries to create new ingredients
      const isUniqueConstraintOnId = 
        (updateError?.code === 'P2002' && updateError?.meta?.target?.includes('id')) ||
        (updateError?.message?.includes('Unique constraint failed on the fields: (`id`)'))
      
      if (isUniqueConstraintOnId) {
        // This is expected when sequences get out of sync (e.g., after data imports)
        // We'll automatically fix it by resetting the sequences
        console.log(`[processAndSaveIngredients] Sequence out of sync detected for recipe ${recipeId} (model: ${updateError?.meta?.modelName || 'unknown'}), auto-fixing...`)
        
        try {
          // Reset the Ingredient sequence (most likely culprit when creating via connectOrCreate)
          await prisma.$executeRawUnsafe(`
            SELECT setval(pg_get_serial_sequence('"Ingredient"', 'id'), 
                          COALESCE((SELECT MAX(id) FROM "Ingredient"), 0) + 1, 
                          false)
          `)
          
          // Also reset Recipe sequence just in case
          await prisma.$executeRawUnsafe(`
            SELECT setval(pg_get_serial_sequence('"Recipe"', 'id'), 
                          COALESCE((SELECT MAX(id) FROM "Recipe"), 0) + 1, 
                          false)
          `)
          
          console.log(`[processAndSaveIngredients] Sequences reset successfully, retrying update for recipe ${recipeId}...`)
          
          // Retry the update
          updatedRecipe = await prisma.recipe.update({
            where: { id: recipeId },
            data: {
              ingredients: {
                set: [],
                connectOrCreate: ingredientConnectOrCreate
              }
            },
            include: {
              ingredients: {
                select: { id: true, name: true }
              }
            }
          })
          
          console.log(`[processAndSaveIngredients] ✅ Successfully recovered from sequence sync issue for recipe ${recipeId}`)
        } catch (retryError: any) {
          console.error(`[processAndSaveIngredients] ❌ Retry after sequence reset failed for recipe ${recipeId}:`, retryError)
          throw retryError
        }
      } else {
        // Re-throw if it's a different error
        throw updateError
      }
    }
    
    const linkedIngredientNames = updatedRecipe.ingredients.map(ing => ing.name)
    console.log(`✅ Successfully linked ${updatedRecipe.ingredients.length} ingredients to recipe ${recipeId}: ${linkedIngredientNames.join(', ')}`)
    
    const dbTime = Date.now() - dbStartTime
    const totalTime = Date.now() - llmStartTime
    console.log(`✅ Processed and saved ${updatedRecipe.ingredients.length} ingredients for recipe ${recipeId} in ${totalTime}ms (LLM: ${llmTime}ms, DB: ${dbTime}ms)`)
  } catch (err) {
    console.error(`❌ Error processing ingredients for recipe ${recipeId}:`, err)
    throw err
  }
}

