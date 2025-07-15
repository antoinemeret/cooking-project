import { getCanonicalTags, addTagToCanonicalList } from '../src/lib/tag-utils'

async function testCanonicalTags() {
  console.log('Testing canonical tags database integration...')
  
  // Test 1: Get current canonical tags
  console.log('\n1. Getting current canonical tags:')
  const currentTags = await getCanonicalTags(20)
  console.log(`Found ${currentTags.length} tags:`, currentTags.slice(0, 10))
  
  // Test 2: Add some test tags
  console.log('\n2. Adding test tags to canonical list:')
  const testTags = ['test-tag-1', 'test-tag-2', 'test-tag-3']
  for (const tag of testTags) {
    await addTagToCanonicalList(tag, 'test-user')
    console.log(`Added tag: ${tag}`)
  }
  
  // Test 3: Get canonical tags again to see if new ones appear
  console.log('\n3. Getting canonical tags after adding test tags:')
  const updatedTags = await getCanonicalTags(25)
  console.log(`Found ${updatedTags.length} tags:`, updatedTags.slice(0, 15))
  
  // Check if our test tags are in the list
  const foundTestTags = testTags.filter(tag => updatedTags.includes(tag))
  console.log(`\nTest tags found in canonical list: ${foundTestTags.length}/${testTags.length}`)
  if (foundTestTags.length > 0) {
    console.log('Found test tags:', foundTestTags)
  }
  
  console.log('\nTest completed!')
}

testCanonicalTags().catch(console.error) 