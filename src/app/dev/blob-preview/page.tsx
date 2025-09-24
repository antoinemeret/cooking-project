import Image from 'next/image'

function getTestUrl () {
  return process.env.BLOB_TEST_IMAGE_URL || ''
}

export default function BlobPreviewPage () {
  const url = getTestUrl()
  const hasUrl = Boolean(url)

  return (
    <div className='container mx-auto p-6'>
      <h1 className='text-2xl font-bold mb-4'>Blob Image Preview (Dev)</h1>
      {!hasUrl && (
        <p className='text-sm text-red-600 mb-4'>
          Set BLOB_TEST_IMAGE_URL in your environment to a public Vercel Blob image URL to preview here.
        </p>
      )}
      {hasUrl && (
        <div className='max-w-sm'>
          <Image
            src={url}
            alt='Blob test image'
            width={400}
            height={300}
            className='rounded-md shadow'
            priority={false}
          />
          <p className='text-xs text-muted-foreground mt-2 break-all'>{url}</p>
        </div>
      )}
    </div>
  )
}


