import { prisma } from '../src/lib/prisma'

async function populateCanonicalTags() {
  console.log('Populating canonical tags from existing recipes...\n')
  
  try {
    // Get all recipes with their tags
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        tags: true
      }
    })
    
    console.log(`Found ${recipes.length} recipes to process...`)
    
    // Extract all unique tags from recipes
    const allTags = new Map<string, number>() // tag -> frequency
    
    for (const recipe of recipes) {
      if (recipe.tags) {
        try {
          const tags = JSON.parse(recipe.tags)
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (typeof tag === 'string' && tag.trim()) {
                const normalizedTag = tag.trim().toLowerCase()
                allTags.set(normalizedTag, (allTags.get(normalizedTag) || 0) + 1)
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to parse tags for recipe ${recipe.id}:`, error)
        }
      }
    }
    
    console.log(`\nExtracted ${allTags.size} unique tags from recipes:`)
    
    // Sort tags by frequency
    const sortedTags = Array.from(allTags.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
    
    // Display top tags
    console.log('\nTop 20 most used tags:')
    console.log('Tag\t\t\tFrequency')
    console.log('---\t\t\t---------')
    sortedTags.slice(0, 20).forEach(([tag, frequency]) => {
      console.log(`${tag.padEnd(20)}\t${frequency}`)
    })
    
    // Add tags to the canonical list
    console.log('\nAdding tags to canonical database...')
    let addedCount = 0
    let skippedCount = 0
    
    for (const [tag, frequency] of sortedTags) {
      try {
        // Add each tag with its frequency
        await (prisma as any).tagUsage.upsert({
          where: {
            userId_tag: {
              userId: 'system-import',
              tag
            }
          },
          update: {
            frequency: {
              increment: frequency
            },
            lastUsed: new Date()
          },
          create: {
            userId: 'system-import',
            tag,
            frequency,
            lastUsed: new Date()
          }
        })
        addedCount++
        console.log(`✓ Added: ${tag} (frequency: ${frequency})`)
      } catch (error) {
        console.error(`✗ Failed to add tag "${tag}":`, error)
        skippedCount++
      }
    }
    
    console.log(`\nImport completed!`)
    console.log(`✓ Successfully added: ${addedCount} tags`)
    console.log(`✗ Failed to add: ${skippedCount} tags`)
    console.log(`📊 Total unique tags found: ${allTags.size}`)
    
    // Show final canonical list
    console.log('\nFinal canonical tag list:')
    const canonicalTags = await (prisma as any).tagUsage.findMany({
      orderBy: [
        { frequency: 'desc' },
        { lastUsed: 'desc' }
      ],
      select: {
        tag: true,
        frequency: true
      }
    })
    
    console.log('Tag\t\t\tFrequency')
    console.log('---\t\t\t---------')
    canonicalTags.slice(0, 20).forEach((record: any) => {
      console.log(`${record.tag.padEnd(20)}\t${record.frequency}`)
    })
    
  } catch (error) {
    console.error('Error populating canonical tags:', error)
  }
}

populateCanonicalTags().catch(console.error) 