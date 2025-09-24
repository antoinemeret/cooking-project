import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { uploadToBlob } from '@/lib/blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  // Check if this is a JSON request for remote image URL
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const schema = z.object({ imageUrl: z.string().url(), recipeId: z.union([z.string(), z.number()]) })
      const parsed = schema.safeParse(await req.json())
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
      }
      const { imageUrl, recipeId } = parsed.data as { imageUrl: string, recipeId: string | number }
      // Fetch the image from the remote URL
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 })
      }
      const arrayBuffer = await imgRes.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // Optimize/normalize to webp for consistency
      let finalBuffer = buffer
      try {
        finalBuffer = await sharp(buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()
      } catch {
        // if sharp fails, fallback to original bytes
        finalBuffer = buffer
      }

      const key = `recipes/recipe-${recipeId}-remote-${Date.now()}.webp`
      const uploaded = await uploadToBlob(key, finalBuffer, 'image/webp')

      // Update recipe
      const recipe = await prisma.recipe.update({
        where: { id: Number(recipeId) },
        data: { image: uploaded.url }
      })
      return NextResponse.json(recipe)
    } catch (err) {
      return NextResponse.json({ error: 'Failed to process remote image' }, { status: 500 })
    }
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const recipeId = formData.get('recipeId') as string | null

  if (!file || !recipeId) {
    return NextResponse.json({ error: 'Missing file or recipeId' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'jpg'

  // Optimize image: resize, compress, convert to WebP
  const buffer = Buffer.from(await file.arrayBuffer())
  let optimizedBuffer
  let finalPublicUrl = ''

  try {
    optimizedBuffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    const key = `recipes/recipe-${recipeId}-${Date.now()}.webp`
    const uploaded = await uploadToBlob(key, optimizedBuffer, 'image/webp')
    finalPublicUrl = uploaded.url
  } catch (err) {
    // fallback: upload original if sharp fails
    const key = `recipes/recipe-${recipeId}-${Date.now()}.${ext}`
    const uploaded = await uploadToBlob(key, buffer)
    finalPublicUrl = uploaded.url
  }

  // Update recipe
  const recipe = await prisma.recipe.update({
    where: { id: Number(recipeId) },
    data: { image: finalPublicUrl }
  })

  return NextResponse.json(recipe)
} 