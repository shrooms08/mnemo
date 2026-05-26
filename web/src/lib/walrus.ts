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

export async function fetchBlob(blobId: string): Promise<Uint8Array> {
  const aggregator = import.meta.env.VITE_WALRUS_AGGREGATOR as string | undefined
  if (!aggregator) throw new Error('VITE_WALRUS_AGGREGATOR is not set')
  const url = `${aggregator.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`Could not retrieve from Walrus (${res.status}).`)
  }
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}
