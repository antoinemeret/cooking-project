import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

type RecipeDetailPageProps = {
  params: { id: string }
}

export default async function RecipeDetailPage ({ params }: RecipeDetailPageProps) {
  const id = Number(params.id)
  if (isNaN(id)) return notFound()

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true }
  })

  if (!recipe) return notFound()

  const rawIngredients = JSON.parse(recipe.rawIngredients || '[]')

  return (
    <section className='container mx-auto p-4'>
      <h1 className='text-3xl font-bold mb-4'>{recipe.title}</h1>
      <section aria-labelledby='ingredients-heading'>
        <h2 id='ingredients-heading' className='text-xl font-semibold mb-2'>Ingredients</h2>
        <ul className='mb-4 list-disc list-inside'>
          {rawIngredients.map((ingredient: string) => (
            <li key={ingredient}>{ingredient}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby='instructions-heading'>
        <h2 id='instructions-heading' className='text-xl font-semibold mb-2'>Instructions</h2>
        <p>{recipe.instructions}</p>
      </section>
    </section>
  )
}