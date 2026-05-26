type WalrusPutResponse = {
  newlyCreated?: { blobObject?: { blobId?: string } }
  alreadyCertified?: { blobId?: string }
}

export async function uploadBlob(payload: Uint8Array, epochs = 5): Promise<string> {
  const publisher = import.meta.env.VITE_WALRUS_PUBLISHER as string | undefined
  if (!publisher) throw new Error('VITE_WALRUS_PUBLISHER is not set')

  const url = `${publisher.replace(/\/$/, '')}/v1/blobs?epochs=${epochs}`
  // Cast through ArrayBuffer to satisfy RequestInit's BodyInit typing in this TS lib version.
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload.slice().buffer as ArrayBuffer,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Walrus upload failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as WalrusPutResponse
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId
  if (!blobId) {
    throw new Error(`Walrus response missing blobId: ${JSON.stringify(json).slice(0, 200)}`)
  }
  return blobId
}
