import { prisma } from '../src/lib/prisma'

async function viewCanonicalTags() {
  console.log('Viewing canonical tags in database...\n')
  
  try {
    // Get all tag usage records
    const tagUsage = await (prisma as any).tagUsage.findMany({
      orderBy: [
        { frequency: 'desc' },
        { lastUsed: 'desc' }
      ],
      select: {
        id: true,
        userId: true,
        tag: true,
        frequency: true,
        lastUsed: true
      }
    })
    
    if (tagUsage.length === 0) {
      console.log('No tags found in database yet.')
      console.log('Tags will appear here after users manually add them to recipes.')
      return
    }
    
    console.log(`Found ${tagUsage.length} tags in canonical list:\n`)
    
    // Display tags in a table format
    console.log('ID\tUser\tTag\t\t\tFrequency\tLast Used')
    console.log('--\t----\t---\t\t\t---------\t---------')
    
    tagUsage.forEach((record: any) => {
      const date = new Date(record.lastUsed).toLocaleDateString()
      console.log(`${record.id}\t${record.userId}\t${record.tag.padEnd(20)}\t${record.frequency}\t\t${date}`)
    })
    
    console.log(`\nTotal tags: ${tagUsage.length}`)
    console.log(`Total usage count: ${tagUsage.reduce((sum: number, r: any) => sum + r.frequency, 0)}`)
    
  } catch (error) {
    console.error('Error viewing canonical tags:', error)
  }
}

viewCanonicalTags().catch(console.error) 