import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create ingredients
  const tomato = await prisma.ingredient.create({
    data: {
      name: 'Tomato',
      startSeason: 6, // June
      endSeason: 10,  // October
    },
  })

  const basil = await prisma.ingredient.create({
    data: {
      name: 'Basil',
      startSeason: 5, // May
      endSeason: 9,   // September
    },
  })

  // Create a recipe
  const recipe = await prisma.recipe.create({
    data: {
      title: 'Tomato Basil Pasta',
      summary: 'A simple pasta dish with fresh tomatoes and basil.',
      instructions: 'Cook pasta. Mix with chopped tomatoes and basil.',
      rawIngredients: JSON.stringify([
        { name: 'Pasta', quantity: '200g' },
        { name: 'Tomatoes', quantity: '3 medium' },
        { name: 'Fresh basil', quantity: '10 leaves' }
      ]),
      startSeason: 6, // June
      endSeason: 9,   // September
      grade: 3,
      time: 30,
      ingredients: {
        connect: [{ id: tomato.id }, { id: basil.id }],
      },
    },
  })

  console.log('Created recipe:', recipe)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })