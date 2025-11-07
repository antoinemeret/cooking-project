import { PrismaClient } from '@prisma/client'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const pexec = promisify(execFile)

async function exportTable (dbPath: string, table: string): Promise<any[]> {
  const { stdout } = await pexec('sqlite3', [dbPath, '-json', `select * from ${table};`])
  if (!stdout) return []
  try {
    return JSON.parse(stdout)
  } catch {
    return []
  }
}

async function main () {
  const cloudUrl = process.env.DATABASE_URL
  if (!cloudUrl || cloudUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL must be set to Prisma Cloud Postgres for this script')
  }
  const prisma = new PrismaClient()
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

  // Order matters for FKs
  const recipes = await exportTable(dbPath, 'Recipe')
  console.log(`Exported Recipe: ${recipes.length}`)
  for (const r of recipes) {
    const createdAt = typeof r.createdAt === 'number' ? new Date(r.createdAt) : new Date(r.createdAt)
    const updatedAt = typeof r.updatedAt === 'number' ? new Date(r.updatedAt) : new Date(r.updatedAt)
    await prisma.recipe.upsert({
      where: { id: r.id },
      update: {
        title: r.title,
        summary: r.summary,
        instructions: r.instructions,
        rawIngredients: r.rawIngredients,
        tags: r.tags,
        metadata: r.metadata,
        startSeason: r.startSeason,
        endSeason: r.endSeason,
        grade: r.grade,
        preparationTime: r.preparationTime,
        cookingTime: r.cookingTime,
        image: r.image
      },
      create: {
        id: r.id,
        title: r.title,
        summary: r.summary,
        instructions: r.instructions,
        rawIngredients: r.rawIngredients,
        tags: r.tags,
        metadata: r.metadata,
        startSeason: r.startSeason,
        endSeason: r.endSeason,
        grade: r.grade,
        preparationTime: r.preparationTime,
        cookingTime: r.cookingTime,
        image: r.image,
        createdAt,
        updatedAt
      }
    })
  }

  const ingredients = await exportTable(dbPath, 'Ingredient')
  console.log(`Exported Ingredient: ${ingredients.length}`)
  for (const r of ingredients) {
    const createdAt = typeof r.createdAt === 'number' ? new Date(r.createdAt) : new Date(r.createdAt)
    const updatedAt = typeof r.updatedAt === 'number' ? new Date(r.updatedAt) : new Date(r.updatedAt)
    await prisma.ingredient.upsert({
      where: { id: r.id },
      update: { name: r.name, startSeason: r.startSeason, endSeason: r.endSeason },
      create: { id: r.id, name: r.name, startSeason: r.startSeason, endSeason: r.endSeason, createdAt, updatedAt }
    })
  }

  const mealPlans = await exportTable(dbPath, 'MealPlan')
  console.log(`Exported MealPlan: ${mealPlans.length}`)
  for (const r of mealPlans) {
    const createdAt = typeof r.createdAt === 'number' ? new Date(r.createdAt) : new Date(r.createdAt)
    const updatedAt = typeof r.updatedAt === 'number' ? new Date(r.updatedAt) : new Date(r.updatedAt)
    await prisma.mealPlan.upsert({
      where: { id: r.id },
      update: { userId: r.userId, status: r.status },
      create: { id: r.id, userId: r.userId, status: r.status, createdAt, updatedAt }
    })
  }

  const planned = await exportTable(dbPath, 'PlannedRecipe')
  console.log(`Exported PlannedRecipe: ${planned.length}`)
  for (const r of planned) {
    const addedAt = typeof r.addedAt === 'number' ? new Date(r.addedAt) : new Date(r.addedAt)
    const completed: boolean = typeof r.completed === 'boolean' ? r.completed : r.completed === 1
    await prisma.plannedRecipe.upsert({
      where: { id: r.id },
      update: { mealPlanId: r.mealPlanId, recipeId: r.recipeId, completed },
      create: { id: r.id, mealPlanId: r.mealPlanId, recipeId: r.recipeId, completed, addedAt }
    })
  }

  const grocery = await exportTable(dbPath, 'GroceryList')
  console.log(`Exported GroceryList: ${grocery.length}`)
  for (const r of grocery) {
    const createdAt = typeof r.createdAt === 'number' ? new Date(r.createdAt) : new Date(r.createdAt)
    const updatedAt = typeof r.updatedAt === 'number' ? new Date(r.updatedAt) : new Date(r.updatedAt)
    await prisma.groceryList.upsert({
      where: { id: r.id },
      update: { mealPlanId: r.mealPlanId, ingredients: r.ingredients, checkedItems: r.checkedItems },
      create: { id: r.id, mealPlanId: r.mealPlanId, ingredients: r.ingredients, checkedItems: r.checkedItems, createdAt, updatedAt }
    })
  }

  const tagUsage = await exportTable(dbPath, 'TagUsage')
  console.log(`Exported TagUsage: ${tagUsage.length}`)
  for (const r of tagUsage) {
    const lastUsed = typeof r.lastUsed === 'number' ? new Date(r.lastUsed) : new Date(r.lastUsed)
    await prisma.tagUsage.upsert({
      where: { id: r.id },
      update: { userId: r.userId, tag: r.tag, frequency: r.frequency, lastUsed },
      create: { id: r.id, userId: r.userId, tag: r.tag, frequency: r.frequency, lastUsed }
    })
  }

  await prisma.$disconnect()
  console.log('✅ Data transfer complete')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})


