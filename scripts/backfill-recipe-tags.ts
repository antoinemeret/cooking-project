import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Tag detection patterns
const TAG_PATTERNS = {
  // Dietary restrictions
  vegetarian: [
    /\bvegetarian\b/i,
    /\bveggie\b/i,
    /no meat/i,
    /without meat/i
  ],
  vegan: [
    /\bvegan\b/i,
    /plant.based/i,
    /dairy.free.*egg.free/i
  ],
  'gluten-free': [
    /gluten.free/i,
    /\bgf\b/i,
    /no gluten/i,
    /without gluten/i
  ],
  'dairy-free': [
    /dairy.free/i,
    /lactose.free/i,
    /no dairy/i,
    /without dairy/i,
    /no milk/i,
    /no cheese/i
  ],
  'nut-free': [
    /nut.free/i,
    /no nuts/i,
    /without nuts/i,
    /allergy.friendly/i
  ],
  
  // Meal types
  breakfast: [
    /\bbreakfast\b/i,
    /\bbrunch\b/i,
    /morning/i,
    /\boats\b/i,
    /\bcereal\b/i,
    /\bpancake/i,
    /\bwaffle/i,
    /\beggs?\b/i,
    /\bomelet/i
  ],
  lunch: [
    /\blunch\b/i,
    /\bsandwich\b/i,
    /\bwrap\b/i,
    /\bsalad\b/i,
    /\bsoup\b/i
  ],
  dinner: [
    /\bdinner\b/i,
    /\bmain course/i,
    /\bentree/i,
    /\bmain dish/i
  ],
  dessert: [
    /\bdessert\b/i,
    /\bsweet\b/i,
    /\bcake\b/i,
    /\bcookie/i,
    /\bpie\b/i,
    /\bice cream/i,
    /\bchocolate/i,
    /\bpudding/i
  ],
  snack: [
    /\bsnack\b/i,
    /\bappetizer/i,
    /\bstarter/i,
    /quick bite/i
  ],
  
  // Cooking methods
  'quick & easy': [
    /quick/i,
    /easy/i,
    /simple/i,
    /fast/i,
    /\b15.min/i,
    /\b20.min/i,
    /\b30.min/i,
    /one.pot/i,
    /no.cook/i
  ],
  baked: [
    /\bbaked?\b/i,
    /\boven/i,
    /\broast/i,
    /\bgratin/i,
    /\bcasserole/i
  ],
  grilled: [
    /\bgrilled?\b/i,
    /\bbarbecue/i,
    /\bbbq\b/i,
    /\bcharred/i
  ],
  'slow-cooked': [
    /slow.cook/i,
    /\bbraised?\b/i,
    /\bstewed?\b/i,
    /crock.pot/i,
    /slow.cooker/i
  ],
  
  // Cuisine types
  italian: [
    /\bitalian\b/i,
    /\bpasta\b/i,
    /\bpizza\b/i,
    /\brisotto\b/i,
    /\bbasil\b/i,
    /\bparmesan\b/i,
    /\bmozzarella\b/i
  ],
  asian: [
    /\basian\b/i,
    /\bchinese\b/i,
    /\bjapanese\b/i,
    /\bthai\b/i,
    /\bsoy sauce\b/i,
    /\bginger\b/i,
    /\brice\b/i,
    /\bnoodles\b/i
  ],
  mexican: [
    /\bmexican\b/i,
    /\btaco\b/i,
    /\bburrito\b/i,
    /\bsalsa\b/i,
    /\bavocado\b/i,
    /\bcilantro\b/i,
    /\blime\b/i
  ],
  mediterranean: [
    /mediterranean/i,
    /\bgreek\b/i,
    /\bolive oil\b/i,
    /\bfeta\b/i,
    /\bolives\b/i,
    /\btomatoes\b/i
  ],
  
  // Ingredient-based
  chicken: [
    /\bchicken\b/i,
    /\bpoultry\b/i
  ],
  beef: [
    /\bbeef\b/i,
    /\bsteak\b/i,
    /\bground beef\b/i
  ],
  pork: [
    /\bpork\b/i,
    /\bbacon\b/i,
    /\bham\b/i,
    /\bsausage\b/i
  ],
  seafood: [
    /\bfish\b/i,
    /\bsalmon\b/i,
    /\btuna\b/i,
    /\bshrimp\b/i,
    /\bseafood\b/i,
    /\bcrab\b/i,
    /\blobster\b/i
  ],
  pasta: [
    /\bpasta\b/i,
    /\bspaghetti\b/i,
    /\bpenne\b/i,
    /\bfettuccine\b/i,
    /\blasagna\b/i,
    /\bravioli\b/i
  ],
  rice: [
    /\brice\b/i,
    /\brisotto\b/i,
    /\bpilaf\b/i
  ],
  salad: [
    /\bsalad\b/i,
    /\bgreens\b/i,
    /\blettuce\b/i,
    /\bspinach\b/i,
    /\barugula\b/i
  ],
  soup: [
    /\bsoup\b/i,
    /\bbroth\b/i,
    /\bstew\b/i,
    /\bbisque\b/i,
    /\bchowder\b/i
  ]
}

/**
 * Analyze recipe content and suggest tags
 */
function suggestTags(recipe: { title: string; summary: string; rawIngredients: string }): string[] {
  const searchText = `${recipe.title} ${recipe.summary} ${recipe.rawIngredients}`.toLowerCase()
  const suggestedTags: string[] = []
  
  for (const [tag, patterns] of Object.entries(TAG_PATTERNS)) {
    const matches = patterns.some(pattern => pattern.test(searchText))
    if (matches) {
      suggestedTags.push(tag)
    }
  }
  
  return suggestedTags
}

/**
 * Parse existing tags from JSON string
 */
function parseExistingTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Main backfill function
 */
async function backfillRecipeTags() {
  console.log('🏷️  Starting recipe tags backfill...')
  
  try {
    // Fetch all recipes
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        summary: true,
        rawIngredients: true,
        tags: true
      }
    })
    
    console.log(`📋 Found ${recipes.length} recipes to analyze`)
    
    let updatedCount = 0
    let skippedCount = 0
    
    for (const recipe of recipes) {
      const existingTags = parseExistingTags(recipe.tags)
      
      // Skip if recipe already has tags
      if (existingTags.length > 0) {
        console.log(`⏭️  Skipping "${recipe.title}" - already has tags: ${existingTags.join(', ')}`)
        skippedCount++
        continue
      }
      
      // Suggest tags based on content
      const suggestedTags = suggestTags(recipe)
      
      if (suggestedTags.length > 0) {
        // Update recipe with suggested tags
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { tags: JSON.stringify(suggestedTags) }
        })
        
        console.log(`✅ Updated "${recipe.title}" with tags: ${suggestedTags.join(', ')}`)
        updatedCount++
      } else {
        console.log(`❓ No tags suggested for "${recipe.title}"`)
        skippedCount++
      }
    }
    
    console.log('\n🎉 Backfill completed!')
    console.log(`📊 Updated: ${updatedCount} recipes`)
    console.log(`⏭️  Skipped: ${skippedCount} recipes`)
    
  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillRecipeTags()
    .then(() => {
      console.log('✅ Backfill script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Backfill script failed:', error)
      process.exit(1)
    })
}

export { backfillRecipeTags, suggestTags } 