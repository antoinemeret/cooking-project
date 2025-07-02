const { Ollama } = require('ollama')

// Our known French transcription from the salmorejo video
const frenchTranscription = `Et ça part sur un salmoref, une soupe froide espagnol à base de pain et de tombe. C'est si, vous allez voir, on commence par l'avait et retiré le pédon cul d'etomate. Une fois que c'est fait, on les dépôse tout dans le bol de notre blender. On ajoute une petite goose d'oeil coupée grossièrement, et on va mixer le tout une première fois. On veut un rendu bien lisse alors le blender au maximum. Au bout de quelques minutes, on peut ajouter les morceaux de pain, un peu de sel, du poivre, un peu de piment d'espoirait. J'adore le piment d'espoirait. Je rajoute un peu de vinaigre devant aujourd'hui. On relance le blender et on manque le tout avec une généreuse d'oeil de l'oeil. On laisse reposer au frigo pour qu'il soit bien frais, c'est très important pendant ce temps, on prépare. Un œuf dure, non, mais regardez-moi cette texture. On est des petits fouilles, alors on ajoute un peu de jamboybéric, et on vient rapé délicatement notre œuf dure, un peu d'huile. Et c'est prête, on n'a pas plus de recettes.`

const getRecipeStructuringPrompt = (transcription, metadata) => `
You are an expert recipe extraction AI. Extract a recipe from this video transcription.

TRANSCRIPTION (in French):
${transcription}

IMPORTANT: Since the transcription is in French, respond entirely in French.

Extract and structure this into a recipe with this JSON format:

{
  "title": "Nom de la recette en français",
  "rawIngredients": ["ingrédient 1", "ingrédient 2", "..."],
  "instructions": [
    {
      "text": "Description de l'étape en français",
      "order": 1
    },
    {
      "text": "Description de l'étape suivante en français", 
      "order": 2
    }
  ],
  "language": "fr",
  "confidence": "high/medium/low"
}

RULES:
1. Title, ingredients, and instructions must be in French
2. Extract all mentioned ingredients 
3. Create clear step-by-step instructions
4. Return only valid JSON

${metadata ? `Metadata: ${JSON.stringify(metadata, null, 2)}` : ''}`

async function testRecipeStructuring() {
  try {
    console.log('Testing Deepseek recipe structuring...')
    console.log('Transcription length:', frenchTranscription.length, 'characters')
    
    const ollama = new Ollama()
    
    // Test if mistral model is available
    const models = await ollama.list()
    const mistralModel = models.models.find(m => m.name.includes('mistral'))
    if (!mistralModel) {
      console.log('❌ No Mistral model found!')
      return
    }
    console.log('✅ Found Mistral model:', mistralModel.name)
    
    // Test recipe structuring
    console.log('\n🔄 Sending transcription to Mistral...')
    const response = await ollama.generate({
      model: 'mistral:7b-instruct',
      prompt: getRecipeStructuringPrompt(frenchTranscription, {}),
      stream: false
    })
    
    console.log('\n📝 Raw response from Mistral:')
    console.log('=' .repeat(50))
    console.log(response.response)
    console.log('=' .repeat(50))
    
    // Try to parse JSON
    console.log('\n🔍 Attempting to parse JSON...')
    let content = response.response
    
    // Handle deepseek-r1's thinking format
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      console.log('Found JSON in code block')
      content = jsonMatch[1]
    } else {
      // Try to find JSON in the response
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        console.log('Found JSON in response body')
        content = content.substring(jsonStart, jsonEnd + 1)
      }
    }
    
    console.log('\n📋 Extracted JSON content:')
    console.log(content)
    
    const structuredData = JSON.parse(content)
    console.log('\n✅ Successfully parsed JSON:')
    console.log(JSON.stringify(structuredData, null, 2))
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.message.includes('JSON')) {
      console.log('\n🔧 JSON parsing failed. The AI response might not be valid JSON.')
    }
  }
}

testRecipeStructuring() 