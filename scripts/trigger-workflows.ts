/**
 * Script to manually trigger async workflows for recipes
 * Usage: npx tsx scripts/trigger-workflows.ts <recipeId1> [recipeId2] ...
 * Or: node --loader ts-node/esm scripts/trigger-workflows.ts <recipeId1> [recipeId2] ...
 */

import { generateAndSaveSummary, processAndSaveIngredients, estimateAndSaveTimes } from '../src/lib/recipe-processing.js'

async function main() {
  const recipeIds = process.argv.slice(2).map(id => parseInt(id, 10)).filter(id => !isNaN(id))
  
  if (recipeIds.length === 0) {
    console.error('Usage: npx ts-node scripts/trigger-workflows.ts <recipeId1> [recipeId2] ...')
    process.exit(1)
  }

  for (const recipeId of recipeIds) {
    console.log(`\n🔄 Processing recipe ${recipeId}...`)
    
    try {
      // Generate summary
      console.log(`📝 Triggering summary generation...`)
      await generateAndSaveSummary(recipeId)
      
      // Process ingredients
      console.log(`🥕 Triggering ingredient processing...`)
      await processAndSaveIngredients(recipeId)
      
      // Estimate times
      console.log(`⏱️ Triggering time estimation...`)
      await estimateAndSaveTimes(recipeId)
      
      console.log(`✅ Completed workflows for recipe ${recipeId}`)
    } catch (error) {
      console.error(`❌ Error processing recipe ${recipeId}:`, error)
    }
  }
}

main()
  .then(() => {
    console.log('\n✅ All workflows completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })

