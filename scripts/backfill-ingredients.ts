import { prisma } from '../src/lib/prisma'

async function processRecipeIngredients (recipeId: number) {
  try {
    const response = await fetch('http://localhost:3000/api/recipes/process-ingredients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipeId })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`  ✗ Failed to process recipe ${recipeId}: ${response.statusText}`)
      if (errorData.error) {
        console.error(`    Error: ${errorData.error}`)
      }
      if (errorData.details) {
        console.error(`    Details: ${errorData.details}`)
      }
      return false
    }

    const data = await response.json()
    if (data.warning) {
      console.log(`  ⚠ Processed recipe ${recipeId} with warning: ${data.warning}`)
    } else {
      console.log(`  ✓ Processed recipe ${recipeId}: ${data.recipe.ingredients.length} ingredients`)
    }
    return true
  } catch (error) {
    console.error(`  ✗ Network error processing recipe ${recipeId}:`, error)
    return false
  }
}

async function backfillIngredients () {
  try {
    // Configuration: set to true to skip recipes that already have ingredients
    const SKIP_EXISTING = true

    // Get all recipes with rawIngredients
    const recipes = await prisma.recipe.findMany({
      where: {
        rawIngredients: {
          not: '[]'
        }
      },
      select: {
        id: true,
        title: true,
        rawIngredients: true,
        ingredients: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    })

    console.log(`Found ${recipes.length} recipes with raw ingredients`)
    console.log(`Skip existing: ${SKIP_EXISTING ? 'YES' : 'NO'}\n`)

    let processed = 0
    let skipped = 0
    let failed = 0

    for (const recipe of recipes) {
      const rawIngredientsCount = JSON.parse(recipe.rawIngredients || '[]').length
      const currentIngredientsCount = recipe.ingredients.length

      console.log(`\nRecipe ${recipe.id}: "${recipe.title}"`)
      console.log(`  Raw ingredients: ${rawIngredientsCount}`)
      console.log(`  Current ingredients: ${currentIngredientsCount}`)

      // Skip if already has ingredients and SKIP_EXISTING is true
      if (SKIP_EXISTING && currentIngredientsCount > 0) {
        console.log(`  ⊘ Skipped (already has ${currentIngredientsCount} ingredients)`)
        skipped++
        continue
      }

      // Process if there are raw ingredients
      if (rawIngredientsCount > 0) {
        const success = await processRecipeIngredients(recipe.id)
        if (success) {
          processed++
        } else {
          failed++
        }
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        console.log(`  ⊘ Skipped (no raw ingredients)`)
        skipped++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('Backfill complete!')
    console.log(`Processed: ${processed}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Failed: ${failed}`)
    console.log('='.repeat(50))
  } catch (error) {
    console.error('Error during backfill:', error)
  } finally {
    await prisma.$disconnect()
  }
}

backfillIngredients()

