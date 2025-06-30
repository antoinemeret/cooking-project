/**
 * Enhanced recipe tags backfill script
 * Analyzes recipe titles, summaries, and ingredients to automatically assign relevant tags
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Enhanced tag patterns for better detection
const tagPatterns = {
  // Dietary restrictions
  vegetarian: [
    /\b(vegetarian|veggie|légumes|légume|tomate|courgette|aubergine|poivron|salade|quinoa|avocats?|fèves?|haricots?)\b/i,
    /\b(pasta|risotto|tarte|ratatouille|noisettes?|herbes?|feta|oseille|sumac)\b/i,
    /\b(no meat|sans viande|végétarien)\b/i
  ],
  vegan: [
    /\b(vegan|végétalien|sans produits? laitiers?)\b/i,
    /\b(quinoa|avocats?|légumes?|tomate|courgette|aubergine|poivron)\b/i
  ],
  'gluten-free': [
    /\b(gluten.free|sans gluten|quinoa|salade|légumes?)\b/i,
    /\b(rice|riz|risotto)\b/i
  ],
  'dairy-free': [
    /\b(dairy.free|sans produits? laitiers?|sans fromage)\b/i,
    /\b(vegan|végétalien)\b/i
  ],

  // Meal types
  salad: [
    /\b(salade|salad)\b/i,
    /\b(quinoa.*fèves?|avocats?.*quinoa|courgettes.*noisettes?)\b/i
  ],
  soup: [
    /\b(soupe|soup|potage|velouté)\b/i
  ],
  pasta: [
    /\b(pasta|pâtes?|spaghetti|linguine|penne)\b/i,
    /\b(roulés.*courgettes|basil.*pasta)\b/i
  ],
  rice: [
    /\b(rice|riz|risotto|pilaf|boulghour)\b/i
  ],
  dessert: [
    /\b(dessert|gâteau|tarte.*sucr|mousse|crème)\b/i
  ],

  // Cooking methods
  'quick & easy': [
    /\b(quick|easy|facile|rapide|simple)\b/i,
    /\b(poêlé|sauté|grillé|15.min|20.min|30.min)\b/i,
    /\b(salade|pasta|pilaf)\b/i
  ],
  baked: [
    /\b(baked|au four|rôti|tarte|farcies?)\b/i,
    /\b(gratin|grillé|tomates.*farcies?)\b/i
  ],
  grilled: [
    /\b(grilled|grillé|barbecue|bbq)\b/i,
    /\b(pain.*grillé)\b/i
  ],

  // Cuisines
  italian: [
    /\b(italian|italien|italienne|pasta|risotto|basil|basilic)\b/i,
    /\b(roulés.*italienne|courgettes.*noisettes)\b/i
  ],
  mediterranean: [
    /\b(mediterranean|méditerranéen|feta|sumac|herbes?|basilic)\b/i,
    /\b(tomates?.*herbes?|haricots.*feta)\b/i
  ],
  moroccan: [
    /\b(moroccan|marocain|zaalouk|caviar.*aubergines?|maroc)\b/i
  ],
  french: [
    /\b(french|français|française|ratatouille|tarte.*fine)\b/i,
    /\b(courgettes.*chèvre|tamara)\b/i
  ],

  // Special ingredients
  cheese: [
    /\b(cheese|fromage|feta|chèvre|parmesan)\b/i
  ],
  seafood: [
    /\b(seafood|crevettes?|poisson|saumon|thon)\b/i
  ],
  nuts: [
    /\b(nuts|noisettes?|amandes?|noix)\b/i
  ]
}

// Enhanced ingredient-based detection
const ingredientPatterns = {
  vegetarian: [
    'tomate', 'courgette', 'aubergine', 'poivron', 'légumes', 'quinoa', 
    'avocats', 'fèves', 'haricots', 'oseille', 'herbes', 'basilic',
    'noisettes', 'fromage', 'feta', 'chèvre', 'oeufs', 'pasta', 'riz'
  ],
  seafood: [
    'crevettes', 'poisson', 'saumon', 'thon', 'fruits de mer'
  ],
  'dairy-free': [], // Will be determined by absence of dairy + presence of vegan indicators
  'gluten-free': [
    'quinoa', 'riz', 'risotto' // Recipes that are naturally gluten-free
  ]
}

/**
 * Analyze recipe content and suggest tags
 */
function analyzeRecipe(recipe: any): string[] {
  const suggestedTags = new Set<string>()
  const content = `${recipe.title} ${recipe.summary} ${recipe.instructions}`.toLowerCase()
  
  // Parse ingredients for additional context
  let ingredients: string[] = []
  try {
    ingredients = JSON.parse(recipe.rawIngredients || '[]')
  } catch (e) {
    // Fallback to empty array if parsing fails
  }
  const ingredientText = ingredients.join(' ').toLowerCase()
  const fullText = `${content} ${ingredientText}`

  // Check each tag pattern
  for (const [tag, patterns] of Object.entries(tagPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(fullText)) {
        suggestedTags.add(tag)
        break
      }
    }
  }

  // Special logic for vegetarian detection
  const hasVegetarianIngredients = ingredientPatterns.vegetarian.some(ing => 
    fullText.includes(ing)
  )
  const hasMeatKeywords = /\b(chicken|beef|pork|meat|viande|poulet|boeuf|porc|agneau|lamb)\b/i.test(fullText)
  const hasSeafood = ingredientPatterns.seafood.some(ing => fullText.includes(ing))
  
  if (hasVegetarianIngredients && !hasMeatKeywords && !hasSeafood) {
    suggestedTags.add('vegetarian')
  }

  // Special logic for dairy-free
  const hasDairy = /\b(cheese|fromage|feta|chèvre|parmesan|cream|crème|milk|lait|butter|beurre)\b/i.test(fullText)
  if (!hasDairy && (suggestedTags.has('vegan') || /\b(dairy.free|sans produits? laitiers?)\b/i.test(fullText))) {
    suggestedTags.add('dairy-free')
  }

  // Convert Set to Array and filter out any empty tags
  return Array.from(suggestedTags).filter(tag => tag.length > 0)
}

/**
 * Main backfill function
 */
async function backfillRecipeTags() {
  console.log('🏷️  Starting enhanced recipe tags backfill...')
  
  // Get all recipes
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      summary: true,
      instructions: true,
      rawIngredients: true,
      tags: true
    }
  })
  
  console.log(`📋 Found ${recipes.length} recipes to analyze`)
  
  let updatedCount = 0
  let skippedCount = 0
  
  for (const recipe of recipes) {
    // Parse existing tags
    let existingTags: string[] = []
    try {
      existingTags = JSON.parse(recipe.tags || '[]')
    } catch (e) {
      existingTags = []
    }
    
    // Analyze recipe for new tags
    const suggestedTags = analyzeRecipe(recipe)
    
    // Merge with existing tags (avoid duplicates)
    const allTags = [...new Set([...existingTags, ...suggestedTags])]
    
    if (suggestedTags.length > 0 || allTags.length !== existingTags.length) {
      // Update recipe with new tags
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { tags: JSON.stringify(allTags) }
      })
      
      console.log(`✅ Updated "${recipe.title}":`)
      console.log(`   Existing: [${existingTags.join(', ')}]`)
      console.log(`   Added: [${suggestedTags.join(', ')}]`)
      console.log(`   Final: [${allTags.join(', ')}]`)
      updatedCount++
    } else {
      console.log(`⏭️  Skipping "${recipe.title}" - no new tags suggested`)
      skippedCount++
    }
  }
  
  console.log('\n🎉 Enhanced backfill completed!')
  console.log(`📊 Updated: ${updatedCount} recipes`)
  console.log(`⏭️  Skipped: ${skippedCount} recipes`)
}

// Run the backfill
backfillRecipeTags()
  .then(() => {
    console.log('✅ Enhanced backfill script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error during backfill:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  }) 