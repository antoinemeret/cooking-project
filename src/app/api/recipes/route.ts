import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addTagToCanonicalList } from '@/lib/tag-utils'
import { promises as fs } from 'fs'
import * as path from 'path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, rawIngredients, instructions, tags, selectedImageUrl } = body

    if (!title || !Array.isArray(rawIngredients) || !instructions) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const recipe = await prisma.recipe.create({
      data: {
        title,
        summary: '', // Add summary if available
        instructions,
        rawIngredients: JSON.stringify(rawIngredients), // Store as JSON string
        tags: tags || '[]', // Store tags if provided
        startSeason: 1, // Set defaults or get from user/LLM
        endSeason: 12,
        grade: 0,
        time: 0
        // Do not connect ingredients here
      },
      include: { ingredients: true }
    })

    // Track image download status for user feedback
    let imageDownloadStatus = 'none' // 'none', 'success', 'failed'
    let imageDownloadMessage = ''

    // Handle image download and save if selectedImageUrl is provided
    if (selectedImageUrl && recipe.id) {
      try {
        console.log('📸 Downloading selected image:', selectedImageUrl)
        
        // Use platform-specific headers for better download success
        const fetchOptions: RequestInit = {}
        
        if (selectedImageUrl.includes('instagram.com') || selectedImageUrl.includes('cdninstagram.com')) {
          // Instagram: Use mobile Safari headers
          fetchOptions.headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
          }
        } else if (selectedImageUrl.includes('tiktok.com') || selectedImageUrl.includes('tiktokcdn.com')) {
          // TikTok: Use mobile headers
          fetchOptions.headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tiktok.com/',
            'Connection': 'keep-alive'
          }
        } else if (selectedImageUrl.includes('youtube.com') || selectedImageUrl.includes('ytimg.com')) {
          // YouTube: Standard headers (YouTube thumbnails are generally accessible)
          fetchOptions.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://www.youtube.com/'
          }
        }
        
        const imgRes = await fetch(selectedImageUrl, fetchOptions)
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const ext = imgRes.headers.get('content-type')?.split('/').pop() || 'jpg'
          const filename = `recipe-${recipe.id}-${Date.now()}.${ext}`
          const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recipes')
          await fs.mkdir(uploadDir, { recursive: true })
          const filePath = path.join(uploadDir, filename)
          await fs.writeFile(filePath, buffer)
          const publicUrl = `/uploads/recipes/${filename}`
          
          // Update recipe with image
          await prisma.recipe.update({
            where: { id: recipe.id },
            data: { image: publicUrl }
          })
          
          // Update the recipe object to include the image
          recipe.image = publicUrl
          console.log('✅ Image saved successfully:', publicUrl)
          imageDownloadStatus = 'success'
          imageDownloadMessage = 'Image saved successfully!'
        } else {
          console.error('❌ Failed to download image:', selectedImageUrl, imgRes.status)
          imageDownloadStatus = 'failed'
          if (selectedImageUrl.includes('instagram.com') || selectedImageUrl.includes('cdninstagram.com')) {
            imageDownloadMessage = 'Could not download image from Instagram due to platform restrictions. You can manually upload an image later.'
          } else if (selectedImageUrl.includes('tiktok.com') || selectedImageUrl.includes('tiktokcdn.com')) {
            imageDownloadMessage = 'Could not download image from TikTok due to platform restrictions. You can manually upload an image later.'
          } else if (selectedImageUrl.includes('youtube.com') || selectedImageUrl.includes('ytimg.com')) {
            imageDownloadMessage = 'Could not download image from YouTube. This is unusual - you can manually upload an image later.'
          } else {
            imageDownloadMessage = 'Could not download image from the source. You can manually upload an image later.'
          }
        }
      } catch (err) {
        console.error('❌ Error downloading/saving image:', err)
        imageDownloadStatus = 'failed'
        imageDownloadMessage = 'Failed to download image due to a technical error. You can manually upload an image later.'
      }
    }

    // Add tags to the canonical list
    if (tags) {
      try {
        const tagArray = JSON.parse(tags)
        if (Array.isArray(tagArray)) {
          for (const tag of tagArray) {
            await addTagToCanonicalList(tag, 'default')
          }
        }
      } catch (error) {
        console.error('Error adding tags to canonical list:', error)
      }
    }

    return NextResponse.json({ 
      recipe,
      imageDownloadStatus,
      imageDownloadMessage: imageDownloadMessage || undefined
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}