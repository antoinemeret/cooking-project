import { PrismaClient as LocalPrisma } from '@prisma/client'
import { PrismaClient as CloudPrisma } from '@prisma/client'
import path from 'path'

async function main () {
  // Configure separate clients by env swapping at runtime
  // Local SQLite via file DSN
  const localUrl = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`
  process.env.DATABASE_URL = localUrl
  const local = new LocalPrisma()

  // Cloud Postgres from env
  const cloudUrl = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL_CLOUD || process.env.DATABASE_URL
  if (!cloudUrl || cloudUrl.startsWith('file:')) {
    throw new Error('Missing CLOUD_DATABASE_URL or DATABASE_URL_CLOUD for cloud Postgres')
  }
  const cloud = new CloudPrisma({ datasources: { db: { url: cloudUrl } } as any })

  // Transfer order: Recipe, Ingredient, PlannedRecipe, MealPlan, GroceryList, TagUsage
  const transfers: Array<{
    name: string,
    count: () => Promise<number>,
    fetch: (skip: number, take: number) => Promise<any[]>,
    insert: (rows: any[]) => Promise<void>,
    truncate?: () => Promise<void>
  }> = [
    {
      name: 'Recipe',
      count: () => local.recipe.count(),
      fetch: (skip, take) => local.recipe.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(
          rows.map(r => cloud.recipe.upsert({
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
            create: r
          }))
        )
      }
    },
    {
      name: 'Ingredient',
      count: () => local.ingredient.count(),
      fetch: (skip, take) => local.ingredient.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(
          rows.map(r => cloud.ingredient.upsert({
            where: { id: r.id },
            update: { name: r.name, startSeason: r.startSeason, endSeason: r.endSeason },
            create: r
          }))
        )
      }
    },
    {
      name: 'MealPlan',
      count: () => local.mealPlan.count(),
      fetch: (skip, take) => local.mealPlan.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(rows.map(r => cloud.mealPlan.upsert({ where: { id: r.id }, update: { userId: r.userId, status: r.status }, create: r })))
      }
    },
    {
      name: 'PlannedRecipe',
      count: () => local.plannedRecipe.count(),
      fetch: (skip, take) => local.plannedRecipe.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(rows.map(r => cloud.plannedRecipe.upsert({ where: { id: r.id }, update: { mealPlanId: r.mealPlanId, recipeId: r.recipeId, completed: r.completed }, create: r })))
      }
    },
    {
      name: 'GroceryList',
      count: () => local.groceryList.count(),
      fetch: (skip, take) => local.groceryList.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(rows.map(r => cloud.groceryList.upsert({ where: { id: r.id }, update: { mealPlanId: r.mealPlanId, ingredients: r.ingredients, checkedItems: r.checkedItems }, create: r })))
      }
    },
    {
      name: 'TagUsage',
      count: () => local.tagUsage.count(),
      fetch: (skip, take) => local.tagUsage.findMany({ skip, take }),
      insert: async rows => {
        if (rows.length === 0) return
        await cloud.$transaction(rows.map(r => cloud.tagUsage.upsert({ where: { id: r.id }, update: { userId: r.userId, tag: r.tag, frequency: r.frequency, lastUsed: r.lastUsed }, create: r })))
      }
    }
  ]

  const pageSize = 100
  for (const t of transfers) {
    const total = await t.count()
    console.log(`Transferring ${t.name}: ${total} rows`)
    for (let skip = 0; skip < total; skip += pageSize) {
      const rows = await t.fetch(skip, pageSize)
      await t.insert(rows)
      console.log(`  ${t.name}: ${Math.min(skip + pageSize, total)}/${total}`)
    }
  }

  await local.$disconnect()
  await cloud.$disconnect()
  console.log('✅ Transfer completed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
