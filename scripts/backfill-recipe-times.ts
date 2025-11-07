import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Generates a random time value from 15 to 120 minutes in 5-minute increments
 */
function generateRandomTime (): number {
  const min = 15
  const max = 120
  const increment = 5
  const steps = (max - min) / increment
  const randomStep = Math.floor(Math.random() * (steps + 1))
  return min + randomStep * increment
}

async function backfillRecipeTimes () {
  console.log('Starting recipe times backfill...')

  try {
    // Get all recipes
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        preparationTime: true,
        cookingTime: true
      }
    })

    console.log(`Found ${recipes.length} recipes to process`)

    let updatedCount = 0

    for (const recipe of recipes) {
      const updates: { preparationTime?: number; cookingTime?: number } = {}

      // Only update if not already set
      if (recipe.preparationTime === null) {
        updates.preparationTime = generateRandomTime()
      }

      if (recipe.cookingTime === null) {
        updates.cookingTime = generateRandomTime()
      }

      if (Object.keys(updates).length > 0) {
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: updates
        })
        updatedCount++
        console.log(
          `Updated recipe "${recipe.title}": prep=${updates.preparationTime || recipe.preparationTime}min, cook=${updates.cookingTime || recipe.cookingTime}min`
        )
      } else {
        console.log(`Skipped recipe "${recipe.title}" (already has times)`)
      }
    }

    console.log(`\n✅ Backfill complete! Updated ${updatedCount} recipes.`)
  } catch (error) {
    console.error('Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillRecipeTimes()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

