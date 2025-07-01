import { 
  parseJsonLD, 
  parseMicrodata, 
  parseHTML, 
  parseTraditional,
  isRecipeDataMeaningful 
} from './traditional-parser'
import { ParsedRecipe, ParsingResult } from '@/types/comparison'

// Mock console methods to avoid cluttering test output
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

beforeAll(() => {
  global.console = { ...global.console, ...mockConsole }
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Traditional Parser', () => {
  describe('parseJsonLD', () => {
    it('should parse valid JSON-LD recipe data', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Recipe",
                "name": "Chocolate Chip Cookies",
                "description": "Delicious homemade cookies",
                "recipeIngredient": [
                  "2 cups flour",
                  "1 cup chocolate chips"
                ],
                "recipeInstructions": [
                  {
                    "@type": "HowToStep",
                    "text": "Mix ingredients"
                  },
                  {
                    "@type": "HowToStep", 
                    "text": "Bake for 12 minutes"
                  }
                ],
                "totalTime": "PT30M",
                "recipeYield": "24",
                "recipeCuisine": "American"
              }
            </script>
          </head>
        </html>
      `

      const result = await parseJsonLD(html)

      expect(result.success).toBe(true)
      expect(result.recipe).not.toBeNull()
      expect(result.recipe!.title).toBe('Chocolate Chip Cookies')
      expect(result.recipe!.summary).toBe('Delicious homemade cookies')
      expect(result.recipe!.ingredients).toEqual(['2 cups flour', '1 cup chocolate chips'])
      expect(result.recipe!.instructions).toEqual(['Mix ingredients', 'Bake for 12 minutes'])
      expect(result.recipe!.cookingTime).toBe(30)
      expect(result.recipe!.servings).toBe(24)
      expect(result.recipe!.cuisine).toBe('American')
      expect(result.parsingMethod).toBe('json-ld')
    })

    it('should handle JSON-LD with @graph structure', async () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Recipe",
                "name": "Pasta Recipe",
                "recipeIngredient": ["pasta", "sauce"]
              }
            ]
          }
        </script>
      `

      const result = await parseJsonLD(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('Pasta Recipe')
      expect(result.recipe!.ingredients).toEqual(['pasta', 'sauce'])
    })

    it('should handle array of JSON-LD objects', async () => {
      const html = `
        <script type="application/ld+json">
          [
            {
              "@type": "WebPage"
            },
            {
              "@type": "Recipe",
              "name": "Array Recipe",
              "recipeIngredient": ["ingredient1"]
            }
          ]
        </script>
      `

      const result = await parseJsonLD(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('Array Recipe')
    })

    it('should parse ISO 8601 duration formats', async () => {
      const testCases = [
        { duration: 'PT1H30M', expected: 90 },
        { duration: 'PT45M', expected: 45 },
        { duration: 'PT2H', expected: 120 }
      ]

      for (const testCase of testCases) {
        const html = `
          <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Test Recipe",
              "totalTime": "${testCase.duration}",
              "recipeIngredient": ["test"]
            }
          </script>
        `

        const result = await parseJsonLD(html)
        expect(result.recipe!.cookingTime).toBe(testCase.expected)
      }
    })

    it('should return failure when no JSON-LD found', async () => {
      const html = '<html><body>No structured data</body></html>'

      const result = await parseJsonLD(html)

      expect(result.success).toBe(false)
      expect(result.recipe).toBeNull()
      expect(result.error).toContain('No JSON-LD structured data found')
      expect(result.parsingMethod).toBe('failed')
    })

    it('should handle malformed JSON gracefully', async () => {
      const html = `
        <script type="application/ld+json">
          { invalid json }
        </script>
      `

      const result = await parseJsonLD(html)

      expect(result.success).toBe(false)
      expect(result.recipe).toBeNull()
      expect(result.error).toContain('No Recipe schema found')
    })

    it('should extract tags from multiple fields', async () => {
      const html = `
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Tagged Recipe",
            "recipeCategory": "Dessert",
            "recipeCuisine": "Italian",
            "keywords": "sweet, baked, easy",
            "recipeIngredient": ["flour"]
          }
        </script>
      `

      const result = await parseJsonLD(html)

      expect(result.recipe!.tags).toEqual(
        expect.arrayContaining(['Dessert', 'Italian', 'sweet', 'baked', 'easy'])
      )
    })
  })

  describe('parseMicrodata', () => {
    it('should parse valid microdata recipe', async () => {
      const html = `
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Microdata Recipe</h1>
          <p itemprop="description">A test recipe</p>
          <ul>
            <li itemprop="recipeIngredient">Ingredient 1</li>
            <li itemprop="recipeIngredient">Ingredient 2</li>
          </ul>
          <ol>
            <li itemprop="recipeInstructions">Step 1</li>
            <li itemprop="recipeInstructions">Step 2</li>
          </ol>
          <meta itemprop="totalTime" content="PT25M">
          <span itemprop="recipeYield">4</span>
        </div>
      `

      const result = await parseMicrodata(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('Microdata Recipe')
      expect(result.recipe!.summary).toBe('A test recipe')
      expect(result.recipe!.ingredients).toEqual(['Ingredient 1', 'Ingredient 2'])
      expect(result.recipe!.instructions).toEqual(['Step 1', 'Step 2'])
      expect(result.recipe!.cookingTime).toBe(25)
      expect(result.recipe!.servings).toBe(4)
      expect(result.parsingMethod).toBe('microdata')
    })

    it('should handle HowToStep microdata', async () => {
      const html = `
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Recipe with Steps</h1>
          <div itemprop="recipeIngredient">Test ingredient</div>
          <div itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="text">Detailed step 1</span>
          </div>
          <div itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="name">Step 2 name</span>
          </div>
        </div>
      `

      const result = await parseMicrodata(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.instructions).toEqual(['Detailed step 1', 'Step 2 name'])
    })

    it('should handle different schema.org URL formats', async () => {
      const urlFormats = [
        'https://schema.org/Recipe',
        'http://schema.org/Recipe',
        'schema.org/Recipe'
      ]

      for (const url of urlFormats) {
        const html = `
          <div itemscope itemtype="${url}">
            <h1 itemprop="name">Test Recipe</h1>
            <span itemprop="recipeIngredient">Test ingredient</span>
          </div>
        `

        const result = await parseMicrodata(html)
        expect(result.success).toBe(true)
        expect(result.recipe!.title).toBe('Test Recipe')
      }
    })

    it('should return failure when no microdata found', async () => {
      const html = '<html><body><h1>No microdata here</h1></body></html>'

      const result = await parseMicrodata(html)

      expect(result.success).toBe(false)
      expect(result.recipe).toBeNull()
      expect(result.error).toContain('No Recipe microdata found')
    })

    it('should extract content and value attributes', async () => {
      const html = `
        <div itemscope itemtype="https://schema.org/Recipe">
          <meta itemprop="name" content="Meta Recipe">
          <input itemprop="description" value="Input description">
          <span itemprop="recipeIngredient">Span ingredient</span>
        </div>
      `

      const result = await parseMicrodata(html)

      expect(result.recipe!.title).toBe('Meta Recipe')
      expect(result.recipe!.summary).toBe('Input description')
      expect(result.recipe!.ingredients).toEqual(['Span ingredient'])
    })
  })

  describe('parseHTML', () => {
    it('should parse recipe using HTML patterns', async () => {
      const html = `
        <html>
          <body>
            <h1 class="recipe-title">HTML Pattern Recipe</h1>
            <div class="recipe-description">A recipe parsed with HTML patterns</div>
            <ul class="recipe-ingredients">
              <li>HTML ingredient 1</li>
              <li>HTML ingredient 2</li>
            </ul>
            <ol class="recipe-instructions">
              <li>HTML instruction 1</li>
              <li>HTML instruction 2</li>
            </ol>
            <div class="cook-time">30 minutes</div>
            <div class="servings">Serves 6</div>
          </body>
        </html>
      `

      const result = await parseHTML(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('HTML Pattern Recipe')
      expect(result.recipe!.summary).toBe('A recipe parsed with HTML patterns')
      expect(result.recipe!.ingredients).toEqual(['HTML ingredient 1', 'HTML ingredient 2'])
      expect(result.recipe!.instructions).toEqual(['HTML instruction 1', 'HTML instruction 2'])
      expect(result.recipe!.cookingTime).toBe(30)
      expect(result.recipe!.servings).toBe(6)
      expect(result.parsingMethod).toBe('html-parsing')
    })

    it('should extract time from various text formats', async () => {
      const timeTests = [
        { text: '30 minutes', expected: 30 },
        { text: '1 hour 15 minutes', expected: 75 },
        { text: '2 hours', expected: 120 },
        { text: 'Prep time: 45 mins', expected: 45 },
        { text: 'Cook for 1h 30m', expected: 90 }
      ]

      for (const test of timeTests) {
        const html = `
          <html>
            <body>
              <h1>Recipe</h1>
              <div class="ingredients">Test ingredient</div>
              <div class="cook-time">${test.text}</div>
            </body>
          </html>
        `

        const result = await parseHTML(html)
        expect(result.recipe!.cookingTime).toBe(test.expected)
      }
    })

    it('should extract servings from various patterns', async () => {
      const servingTests = [
        { text: 'Serves 4', expected: 4 },
        { text: '6 servings', expected: 6 },
        { text: 'Makes 12', expected: 12 },
        { text: 'Yield: 8', expected: 8 }
      ]

      for (const test of servingTests) {
        const html = `
          <html>
            <body>
              <h1>Recipe</h1>
              <div class="ingredients">Test ingredient</div>
              <div class="servings">${test.text}</div>
            </body>
          </html>
        `

        const result = await parseHTML(html)
        expect(result.recipe!.servings).toBe(test.expected)
      }
    })

    it('should handle meta tag descriptions', async () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Recipe from meta tag">
          </head>
          <body>
            <h1>Meta Recipe</h1>
            <div class="ingredients">ingredient</div>
          </body>
        </html>
      `

      const result = await parseHTML(html)
      expect(result.recipe!.summary).toBe('Recipe from meta tag')
    })

    it('should return failure when no meaningful data found', async () => {
      const html = '<html><body><p>Not a recipe page</p></body></html>'

      const result = await parseHTML(html)

      expect(result.success).toBe(false)
      expect(result.recipe).toBeNull()
      expect(result.error).toContain('No recipe data found using HTML parsing patterns')
    })

    it('should filter out very short content', async () => {
      const html = `
        <html>
          <body>
            <h1>Recipe Title</h1>
            <ul class="recipe-ingredients">
              <li>Good ingredient with proper length</li>
              <li>X</li>
            </ul>
            <ol class="recipe-instructions">
              <li>This is a proper instruction with good length</li>
              <li>No</li>
            </ol>
          </body>
        </html>
      `

      const result = await parseHTML(html)

      expect(result.recipe!.ingredients).toEqual(['Good ingredient with proper length'])
      expect(result.recipe!.instructions).toEqual(['This is a proper instruction with good length'])
    })
  })

  describe('parseTraditional', () => {
    it('should use JSON-LD when available and meaningful', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Recipe",
                "name": "JSON-LD Recipe",
                "recipeIngredient": ["ingredient"],
                "recipeInstructions": ["instruction"]
              }
            </script>
          </head>
          <body>
            <h1 class="recipe-title">HTML Recipe</h1>
            <div class="ingredients">HTML ingredient</div>
          </body>
        </html>
      `

      const result = await parseTraditional(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('JSON-LD Recipe')
      expect(result.parsingMethod).toBe('json-ld')
    })

    it('should fallback to microdata when JSON-LD fails', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              { "invalid": "json" }
            </script>
          </head>
          <body>
            <div itemscope itemtype="https://schema.org/Recipe">
              <h1 itemprop="name">Microdata Recipe</h1>
              <span itemprop="recipeIngredient">ingredient</span>
              <span itemprop="recipeInstructions">instruction</span>
            </div>
          </body>
        </html>
      `

      const result = await parseTraditional(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('Microdata Recipe')
      expect(result.parsingMethod).toBe('microdata')
    })

    it('should fallback to HTML parsing when structured data fails', async () => {
      const html = `
        <html>
          <body>
            <h1 class="recipe-title">HTML Fallback Recipe</h1>
            <ul class="recipe-ingredients">
              <li>HTML ingredient</li>
            </ul>
            <ol class="recipe-instructions">
              <li>HTML instruction</li>
            </ol>
          </body>
        </html>
      `

      const result = await parseTraditional(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toBe('HTML Fallback Recipe')
      expect(result.parsingMethod).toBe('html-parsing')
    })

    it('should handle empty HTML input', async () => {
      const result = await parseTraditional('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Empty or invalid HTML content')
      expect(result.parsingMethod).toBe('failed')
    })

    it('should track attempted methods in failed results', async () => {
      const html = '<html><body><p>Not a recipe</p></body></html>'

      const result = await parseTraditional(html)

      expect(result.success).toBe(false)
      expect(result.extractedRawData.attemptedMethods).toEqual([
        'json-ld', 'microdata', 'html-parsing', 'hybrid'
      ])
    })

    it('should include logs in successful results', async () => {
      const html = `
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Test Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
        </script>
      `

      const result = await parseTraditional(html, 'https://example.com')

      expect(result.success).toBe(true)
      expect(result.extractedRawData.logs).toBeDefined()
      expect(result.extractedRawData.logs.length).toBeGreaterThan(0)
      expect(result.extractedRawData.logs[0].message).toContain('Starting traditional parsing')
    })
  })

  describe('isRecipeDataMeaningful', () => {
    it('should return true for complete recipe data', () => {
      const recipe: ParsedRecipe = {
        title: 'Complete Recipe',
        summary: 'A complete recipe',
        instructions: ['Step 1', 'Step 2'],
        ingredients: ['Ingredient 1', 'Ingredient 2'],
        cookingTime: 30,
        servings: 4,
        difficulty: 'easy',
        cuisine: 'Italian',
        tags: ['tag1']
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(true)
    })

    it('should return true for recipe with title and ingredients only', () => {
      const recipe: ParsedRecipe = {
        title: 'Simple Recipe',
        summary: null,
        instructions: null,
        ingredients: ['Ingredient 1'],
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(true)
    })

    it('should return true for recipe with title and instructions only', () => {
      const recipe: ParsedRecipe = {
        title: 'Instruction Recipe',
        summary: null,
        instructions: ['Step 1'],
        ingredients: null,
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(true)
    })

    it('should return false for recipe without title', () => {
      const recipe: ParsedRecipe = {
        title: null,
        summary: 'No title',
        instructions: ['Step 1'],
        ingredients: ['Ingredient 1'],
        cookingTime: 30,
        servings: 4,
        difficulty: 'easy',
        cuisine: 'Italian',
        tags: ['tag1']
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(false)
    })

    it('should return false for recipe with title but no ingredients or instructions', () => {
      const recipe: ParsedRecipe = {
        title: 'Incomplete Recipe',
        summary: 'Missing key data',
        instructions: null,
        ingredients: null,
        cookingTime: 30,
        servings: 4,
        difficulty: 'easy',
        cuisine: 'Italian',
        tags: ['tag1']
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(false)
    })

    it('should return false for recipe with empty title', () => {
      const recipe: ParsedRecipe = {
        title: '   ',
        summary: null,
        instructions: ['Step 1'],
        ingredients: ['Ingredient 1'],
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(false)
    })

    it('should return false for recipe with empty arrays', () => {
      const recipe: ParsedRecipe = {
        title: 'Empty Recipe',
        summary: null,
        instructions: [],
        ingredients: [],
        cookingTime: null,
        servings: null,
        difficulty: null,
        cuisine: null,
        tags: []
      }

      expect(isRecipeDataMeaningful(recipe)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle cheerio parsing errors gracefully', async () => {
      // Test with malformed HTML that might cause cheerio to throw
      const malformedHTML = '<html><body><div><p>Unclosed tags'

      const result = await parseTraditional(malformedHTML)

      // Should not throw, should handle gracefully
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('should handle very large HTML input', async () => {
      // Create large HTML string
      const largeContent = 'a'.repeat(100000)
      const html = `<html><body><h1>Large Recipe</h1><p>${largeContent}</p><div class="ingredients">ingredient</div></body></html>`

      const result = await parseTraditional(html)

      expect(result).toBeDefined()
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should handle HTML with special characters', async () => {
      const html = `
        <html>
          <body>
            <h1 class="recipe-title">Recipe with Special Characters: éñüñé & < > "</h1>
            <div class="recipe-ingredients">
              <div>Ingredient with émojis 🧅 🥕</div>
            </div>
            <div class="recipe-instructions">
              <div>Step with quotes "mix well" & symbols <>&</div>
            </div>
          </body>
        </html>
      `

      const result = await parseHTML(html)

      expect(result.success).toBe(true)
      expect(result.recipe!.title).toContain('Special Characters')
      expect(result.recipe!.ingredients![0]).toContain('émojis')
      expect(result.recipe!.instructions![0]).toContain('quotes')
    })
  })

  describe('Performance', () => {
    it('should complete parsing within reasonable time', async () => {
      const html = `
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Performance Test Recipe",
            "recipeIngredient": ["ingredient"],
            "recipeInstructions": ["instruction"]
          }
        </script>
      `

      const startTime = Date.now()
      const result = await parseTraditional(html)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.processingTime).toBeLessThan(1000)
    })
  })
}) 