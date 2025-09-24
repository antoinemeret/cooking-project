import { NextRequest } from "next/server";
import { z } from 'zod'
import { Anthropic } from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getRecipeTagSuggestions } from '@/lib/ai-client'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const getRecipeExtractionPrompt = () => `
You are an expert recipe analyzer. Your task is to extract a complete recipe from the provided image.

Please analyze the image and extract the following information in a structured JSON format:

1. **Title**: The recipe name/title
2. **Ingredients**: A complete list of ingredients with quantities and measurements
3. **Instructions**: Step-by-step cooking instructions
4. **Confidence**: Rate your confidence in the extraction (1-10, where 10 is very confident)

IMPORTANT RULES:
- Only extract information that is clearly visible in the image
- If you cannot see certain information clearly, mark it as "unclear" or "not visible"
- Be precise with measurements and quantities
- Maintain the original language of the recipe
- If the image is blurry, unclear, or doesn't contain a recipe, indicate this clearly

Return ONLY a valid JSON object in this format:
{
  "title": "Recipe Title",
  "rawIngredients": ["ingredient 1", "ingredient 2", "..."],
  "instructions": "Step-by-step instructions...",
  "confidence": 8,
  "imageQuality": "good/medium/poor",
  "notes": "Any additional observations about the image or extraction"
}
`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  // Optional: validate additional fields if present
  const title = formData.get('title')
  if (title && typeof title !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid title' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!file) {
    return new Response(JSON.stringify({ error: "No file uploaded." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if Anthropic API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ 
      error: "Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable." 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Enforce image size limit (5MB)
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_IMAGE_SIZE) {
    return new Response(JSON.stringify({ error: "File too large (max 5MB)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const tempFilePath = path.join(os.tmpdir(), `recipe-import-${Date.now()}-${file.name}`);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendJSON = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        await fs.writeFile(tempFilePath, imageBuffer);

        sendJSON({ status: "Analyzing recipe image..." });
        
        // Use Anthropic's Vision API to analyze the image
        // Timeout guard around Anthropic call
        const withTimeout = <T>(p: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Anthropic request timed out')), ms)
          p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
        })

        const response = await withTimeout(anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: getRecipeExtractionPrompt()
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageBuffer.toString('base64')
                  }
                }
              ]
            }
          ]
        }), 20000);

        sendJSON({ status: "Processing extracted data..." });
        
        let structuredData;
        try {
          // Extract JSON from the response
          const content = response.content[0];
          if (content.type === 'text') {
            const textContent = content as { type: 'text'; text: string };
            const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              structuredData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No JSON found in response');
            }
          } else {
            throw new Error('Unexpected response format');
          }
        } catch (jsonError) {
          console.log("Failed to parse JSON from Anthropic response:", jsonError);
          console.log("Raw response:", response.content[0]);
          
          // Try to repair the JSON
          sendJSON({ status: "Repairing data format..." });
          
          const content = response.content[0];
          const textContent = content.type === 'text' ? content as { type: 'text'; text: string } : null;
          const textToRepair = textContent?.text || 'No text content available';
          
          const repairResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: `The following text contains a recipe but the JSON is malformed. Please extract the recipe information and return only a valid JSON object in this format:
{
  "title": "Recipe Title",
  "rawIngredients": ["ingredient 1", "ingredient 2"],
  "instructions": "Step-by-step instructions",
  "confidence": 5,
  "imageQuality": "poor",
  "notes": "Extraction was difficult due to poor image quality"
}

Text to repair:
${textToRepair}`
              }
            ]
          });
          
          const repairContent = repairResponse.content[0];
          if (repairContent.type === 'text') {
            const repairTextContent = repairContent as { type: 'text'; text: string };
            const jsonMatch = repairTextContent.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              structuredData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('Could not extract valid JSON from repair attempt');
            }
          }
        }
        
        // Validate the extracted data
        if (!structuredData || !structuredData.title) {
          throw new Error('Could not extract recipe title from image');
        }
        
        // Get LLM tag suggestions using Anthropic API
        let suggestedTags: string[] = [];
        let suggestedTagsRaw: string = '';
        try {
          console.log('Attempting to get tag suggestions for recipe:', structuredData.title);
          const tagResults = await getRecipeTagSuggestions({
            title: structuredData.title || '',
            ingredients: structuredData.rawIngredients || [],
            instructions: structuredData.instructions || ''
          });
          console.log('Tag suggestion results:', tagResults);
          suggestedTags = tagResults.tags || [];
          suggestedTagsRaw = tagResults.raw || '';
          
          if (suggestedTags.length === 0) {
            console.log('No tags suggested by Anthropic API');
          }
        } catch (err) {
          console.error('Error getting tag suggestions:', err);
          suggestedTags = [];
          suggestedTagsRaw = '';
        }
        
        // Fallback: Use simple pattern matching if no LLM suggestions
        if (suggestedTags.length === 0) {
          console.log('Using fallback tag suggestions based on pattern matching');
          const { extractTagCategories } = await import('@/lib/tag-utils');
          const fallbackTags = extractTagCategories({
            title: structuredData.title || '',
            ingredients: structuredData.rawIngredients || [],
            instructions: structuredData.instructions || ''
          });
          suggestedTags = fallbackTags;
          console.log('Fallback tags suggested:', fallbackTags);
        }
        
        // Add metadata about the extraction
        structuredData.suggestedTags = suggestedTags;
        structuredData.suggestedTagsRaw = suggestedTagsRaw;
        structuredData.extractionMethod = 'anthropic-vision';
        structuredData.confidence = structuredData.confidence || 5;
        structuredData.imageQuality = structuredData.imageQuality || 'unknown';
        
        // Add warning if confidence is low
        if (structuredData.confidence < 6) {
          structuredData.notes = (structuredData.notes || '') + ' [Low confidence extraction - please review carefully]';
        }

        // Send only the fields expected by ImportedRecipe type
        const recipeData = {
          title: structuredData.title,
          rawIngredients: structuredData.rawIngredients || [],
          instructions: structuredData.instructions || '',
          suggestedTags: structuredData.suggestedTags || []
        };

        console.log('Sending final recipe data:', recipeData);
        sendJSON({ status: "done", data: recipeData });
      } catch (error: any) {
        console.error("Error processing photo import:", error);
        const message = typeof error?.message === 'string' ? error.message : String(error)
        const isTimeout = message.toLowerCase().includes('timed out') || message.toLowerCase().includes('timeout')
        const userMessage = isTimeout
          ? 'Image analysis took too long. Please try again later.'
          : (error instanceof Error ? error.message : 'Failed to process the recipe image.')
        sendJSON({ 
          status: 'error', 
          error: userMessage,
          retryAfterMs: isTimeout ? 15000 : undefined
        });
      } finally {
        controller.close();
        // Clean up the temporary file
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error("Failed to clean up temporary file:", cleanupError);
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
} 