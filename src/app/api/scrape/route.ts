import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { parseTraditional, isRecipeDataMeaningful } from '@/lib/scrapers/traditional-parser'

async function extractRecipeWithLLM(prompt: any) {
  let output = ''
  const provider = process.env.LLM_PROVIDER || 'ollama'
  if (provider === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:latest',
        prompt,
        stream: false
      })
    })
    const data = await res.json()

    output = data.response || ''
  } else {
    const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    })
    const data = await res.json()
    output = data?.[0]?.generated_text || data?.generated_text || ''
  }
  return output
}

async function callLLM(html: string, url: string) {
  const $ = cheerio.load(html)
  
  // Extract only recipe-relevant content for LLM (performance optimization)
  // Remove scripts, styles, navigation, ads, comments
  $('script, style, nav, header, footer, aside, .ads, .advertisement, .social, .comments, .sidebar').remove()
  
  // Focus on recipe-specific elements first
  const recipeSelectors = [
    '[class*="recipe"]',
    '[id*="recipe"]', 
    '[class*="ingredient"]',
    '[class*="instruction"]',
    '[class*="direction"]',
    '[class*="method"]',
    'main',
    'article',
    '.content',
    '.post-content'
  ]
  
  let recipeContent = ''
  for (const selector of recipeSelectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      recipeContent = element.text().trim()
      if (recipeContent.length > 200) { // Only use if substantial content
        break
      }
    }
  }
  
  // Fallback to body if no recipe-specific content found
  if (!recipeContent || recipeContent.length < 200) {
    recipeContent = $('body').text()
  }
  
  // Clean up whitespace and limit size more aggressively
  const cleanContent = recipeContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 3000) // Reduced from 8000 to 3000 characters

  const prompt = `Extract recipe data from this text. Return ONLY a JSON object:

{
  "title": "recipe title",
  "rawIngredients": ["ingredient 1", "ingredient 2"],
  "instructions": "cooking instructions",
  "url": "${url}"
}

Text: ${cleanContent}`

  const output = await extractRecipeWithLLM(prompt)

  console.log('Output', output)

  function extractJson(str: string) {
    // Find all JSON objects in the string
    const matches = str.match(/{[\s\S]*?}/g) || []
    // Take the last match, which should be the recipe JSON
    const lastMatch = matches[matches.length - 1]
    if (!lastMatch) return {}
    try {
      return JSON.parse(lastMatch)
    } catch (e) {
      console.error('JSON parse error:', e)
      return {}
    }
  }

  try {
    return extractJson(output)
  } catch {
    return { title: "Erreur de parsing", raw: output, url }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 })

    const htmlRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      }
    })
    if (!htmlRes.ok) {
      const text = await htmlRes.text()
      console.error('Failed to fetch URL', htmlRes.status, text)
      return NextResponse.json({ error: 'Failed to fetch URL', status: htmlRes.status, message: text }, { status: 400 })
    }

    const html = await htmlRes.text()
    
    // Try traditional parser first
    console.log('Attempting traditional parsing first...')
    const traditionalResult = await parseTraditional(html, url)
    
    if (traditionalResult.success && traditionalResult.recipe && isRecipeDataMeaningful(traditionalResult.recipe)) {
      console.log('Traditional parsing successful, using structured data')
      
      // Convert traditional parser result to expected format
      const recipe = {
        title: traditionalResult.recipe.title || "Recipe",
        rawIngredients: traditionalResult.recipe.ingredients || [],
        instructions: traditionalResult.recipe.instructions?.join('\n\n') || traditionalResult.recipe.summary || "",
        url: url,
        parsingMethod: traditionalResult.parsingMethod,
        processingTime: traditionalResult.processingTime
      }
      
      console.log('API response (traditional):', recipe)
      return NextResponse.json({ recipe })
    }
    
    // Fall back to LLM if traditional parsing failed or returned insufficient data
    console.log('Traditional parsing failed or insufficient data, falling back to LLM...')
    const recipe = await callLLM(html, url)
    
    // Add fallback indicator
    recipe.parsingMethod = 'llm-fallback'
    
    console.log('API response (LLM fallback):', recipe)
    return NextResponse.json({ recipe })
    
  } catch (err) {
    console.error('API /api/scrape error:', err)
    return NextResponse.json({ error: 'Server error', message: String(err) }, { status: 500 })
  }
}
