import { prisma } from '../src/lib/prisma'

async function main () {
  const recipeIds = [23, 24]

  console.log('Checking if recipes 23 and 24 exist...\n')

  for (const id of recipeIds) {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { id: true, title: true }
    })

    if (recipe) {
      console.log(`✓ Recipe ${id} exists: "${recipe.title}"`)
      console.log(`  Deleting recipe ${id}...`)
      
      try {
        // Delete related PlannedRecipe entries first (if any)
        await prisma.plannedRecipe.deleteMany({
          where: { recipeId: id }
        })
        
        // Delete the recipe
        await prisma.recipe.delete({
          where: { id }
        })
        
        console.log(`  ✓ Successfully deleted recipe ${id}\n`)
      } catch (error) {
        console.error(`  ✗ Error deleting recipe ${id}:`, error)
        console.log('')
      }
    } else {
      console.log(`✓ Recipe ${id} does not exist (already deleted)\n`)
    }
  }

  // Verify deletion
  console.log('Verifying deletion...\n')
  const remaining = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, title: true }
  })

  if (remaining.length === 0) {
    console.log('✓ Confirmed: Recipes 23 and 24 are no longer in the database')
  } else {
    console.log('✗ Warning: The following recipes still exist:')
    remaining.forEach(r => console.log(`  - Recipe ${r.id}: "${r.title}"`))
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

