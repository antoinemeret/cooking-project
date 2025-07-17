import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const prisma = new PrismaClient()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'recipes')

export async function POST(req: NextRequest) {
  // Check if this is a JSON request for remote image URL
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const { imageUrl, recipeId } = await req.json()
      if (!imageUrl || !recipeId) {
        return NextResponse.json({ error: 'Missing imageUrl or recipeId' }, { status: 400 })
      }
      // Fetch the image from the remote URL
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 })
      }
      const arrayBuffer = await imgRes.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // Guess extension from content-type
      const ext = imgRes.headers.get('content-type')?.split('/').pop() || 'jpg'
      const filename = `recipe-${recipeId}-remote-${Date.now()}.${ext}`
      const filePath = path.join(UPLOAD_DIR, filename)
      const publicUrl = `/uploads/recipes/${filename}`
      // Save the file
      await fs.mkdir(UPLOAD_DIR, { recursive: true })
      await fs.writeFile(filePath, buffer)
      // Update recipe
      const recipe = await prisma.recipe.update({
        where: { id: Number(recipeId) },
        data: { image: publicUrl }
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

  // Ensure upload dir exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `recipe-${recipeId}-${Date.now()}.${ext}`
  const filePath = path.join(UPLOAD_DIR, filename)
  const publicUrl = `/uploads/recipes/${filename}`

  // Optimize image: resize, compress, convert to WebP
  const buffer = Buffer.from(await file.arrayBuffer())
  let optimizedBuffer
  let finalExt = ext.toLowerCase() === 'webp' ? 'webp' : 'webp'
  let finalFilename = `recipe-${recipeId}-${Date.now()}.webp`
  let finalFilePath = path.join(UPLOAD_DIR, finalFilename)
  let finalPublicUrl = `/uploads/recipes/${finalFilename}`

  try {
    optimizedBuffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    await fs.writeFile(finalFilePath, optimizedBuffer)
  } catch (err) {
    // fallback: save original if sharp fails
    await fs.writeFile(filePath, buffer)
    finalPublicUrl = publicUrl
  }

  // Update recipe
  const recipe = await prisma.recipe.update({
    where: { id: Number(recipeId) },
    data: { image: finalPublicUrl }
  })

  return NextResponse.json(recipe)
} 