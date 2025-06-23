import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true }
  })

  for (const recipe of recipes) {
    const ingredientNames = recipe.ingredients.map((ing: { name: string }) => ing.name)
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { rawIngredients: JSON.stringify(ingredientNames) }
    })
    console.log(`Updated recipe ${recipe.id} with rawIngredients:`, ingredientNames)
  }
}

main()
  .catch(err => {
    console.error('Error backfilling rawIngredients:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 