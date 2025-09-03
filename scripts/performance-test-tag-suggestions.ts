import { prisma } from '../src/lib/prisma'
import { getDynamicTagSuggestionPrompt } from '../src/lib/tag-utils'

async function getRandomRecipes(n: number) {
  const count = await prisma.recipe.count()
  if (count === 0) return []
  const skipIndexes = Array.from({ length: Math.min(n, count) }, () => Math.floor(Math.random() * count))
  const recipes = []
  for (const skip of skipIndexes) {
    const recipe = await prisma.recipe.findFirst({ skip, take: 1 })
    if (recipe) recipes.push(recipe)
  }
  return recipes
}

async function callOllamaTagSuggestion(model: string, recipe: { title: string, ingredients: string[], instructions: string }) {
  const dynamicPrompt = await getDynamicTagSuggestionPrompt()
  const prompt = `${dynamicPrompt}\n\nTitle: ${recipe.title}\nIngredients: ${recipe.ingredients.join(', ')}\nInstructions: ${recipe.instructions}`
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  })
  const data = await res.json()
  return data.response || ''
}

const models = [
  { name: 'mistral', model: 'mistral:7b-instruct' },
  { name: 'llama', model: 'llama3:8b' }
]

async function runPerformanceTest() {
  const dbRecipes = await getRandomRecipes(3)
  if (!dbRecipes.length) {
    console.log('No recipes found in the database.')
    return
  }
  
  console.log('Model comparison for tag suggestion using real recipes:')
  console.log('=' .repeat(80))
  
  for (const recipe of dbRecipes) {
    const ingredients = Array.isArray(recipe.rawIngredients)
      ? recipe.rawIngredients
      : (typeof recipe.rawIngredients === 'string' ? JSON.parse(recipe.rawIngredients) : [])
    
    console.log(`\nRecipe: ${recipe.title}`)
    console.log(`Ingredients: ${ingredients.slice(0, 3).join(', ')}${ingredients.length > 3 ? '...' : ''}`)
    console.log(`Instructions: ${(recipe.instructions || '').substring(0, 100)}${(recipe.instructions || '').length > 100 ? '...' : ''}`)
    console.log('-'.repeat(60))
    
    for (const { name, model } of models) {
      const start = Date.now()
      try {
        const responseText = await callOllamaTagSuggestion(model, {
          title: recipe.title,
          ingredients,
          instructions: recipe.instructions || ''
        })
        const elapsed = Date.now() - start
        
        let tags: string[] = []
        let error: string | undefined
        
        try {
          tags = JSON.parse(responseText)
        } catch (err) {
          const match = responseText.match(/\[[\s\S]*?\]/)
          if (match) {
            tags = JSON.parse(match[0])
          } else {
            error = 'Could not parse tags from response'
          }
        }
        
        console.log(`[${name}] ${elapsed}ms | Tags: ${JSON.stringify(tags)}${error ? ' | Error: ' + error : ''}`)
        if (responseText && !tags.length && !error) {
          console.log(`  Raw response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`)
        }
      } catch (err: any) {
        const elapsed = Date.now() - start
        console.log(`[${name}] ${elapsed}ms | Error: ${err.message || err}`)
      }
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('Test completed!')
}

runPerformanceTest().catch(console.error) 