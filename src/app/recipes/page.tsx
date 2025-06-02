import { PrismaClient } from '@prisma/client'
import { DataTable } from './data-table'

const prisma = new PrismaClient()

export default async function RecipesPage() {
  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: true,
    },
  })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Recipes</h1>
      <DataTable recipes={recipes} />
    </div>
  )
}