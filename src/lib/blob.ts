import { del, put } from '@vercel/blob'

type UploadResult = {
  url: string
  pathname: string
}

export async function uploadToBlob (key: string, data: Blob | ArrayBuffer | Uint8Array, contentType?: string): Promise<UploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN')
  }

  const body = data instanceof Blob ? data : new Blob([data])
  const res = await put(key, body, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  })

  return { url: res.url, pathname: res.pathname }
}

export async function deleteFromBlob (urlOrPathname: string): Promise<{ success: boolean }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN')
  }
  await del(urlOrPathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
  return { success: true }
}


