// Uploads a local file to Vercel Blob and prints the public URL
const { put } = require('@vercel/blob')
const fs = require('fs')
const path = require('path')

async function main () {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('Missing BLOB_READ_WRITE_TOKEN')
    process.exit(1)
  }

  const srcPath = path.join(process.cwd(), 'public', 'placeholder-recipe.svg')
  if (!fs.existsSync(srcPath)) {
    console.error('File not found:', srcPath)
    process.exit(1)
  }

  const bytes = fs.readFileSync(srcPath)
  const key = `dev/blob-preview-${Date.now()}.svg`

  const res = await put(key, new Blob([bytes]), {
    access: 'public',
    contentType: 'image/svg+xml',
    token
  })

  console.log(res.url)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})


