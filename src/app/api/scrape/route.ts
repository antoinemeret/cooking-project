import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

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
  const mainContent = $('main').text() || $('body').text()
  const safeContent = mainContent.slice(0, 8000)

  const prompt = `
  You are an extraction tool.

Your job is to extract the title, ingredients list and instructions exactly as written in the HTML.

Return the text exactly. Do NOT rephrase, translate, correct, or interpret anything.

Return only a JSON object in the following format:
{
  "title" (string), 
  "rawIngredients" (array of strings), 
  "instructions" (string), 
  "url" (string).
  }

If you see "500g de tomates mûres", return it exactly like that. DO NOT normalize it to "tomate".

Here is the HTML: ${safeContent}
  `

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
    const recipe = await callLLM(html, url)
    
    console.log('API response:', recipe)

    return NextResponse.json({ recipe })
  } catch (err) {
    console.error('API /api/scrape error:', err)
    return NextResponse.json({ error: 'Server error', message: String(err) }, { status: 500 })
  }
}
