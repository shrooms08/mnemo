export type DecryptedMessage =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; blob: Blob; mimeType: 'audio/webm' }
  | { kind: 'video'; blob: Blob; mimeType: 'video/webm' }

const MAGIC = [0x4d, 0x4e, 0x4d, 0x4f] // "MNMO"

export async function decryptVaultBlob(
  walrusBytes: Uint8Array,
  rawKey: Uint8Array,
): Promise<DecryptedMessage> {
  if (walrusBytes.length < 18) {
    throw new Error('Blob is too small to contain a Mnemo payload header.')
  }
  for (let i = 0; i < 4; i++) {
    if (walrusBytes[i] !== MAGIC[i]) {
      throw new Error('Payload header magic mismatch (not a Mnemo payload).')
    }
  }
  const version = walrusBytes[4]
  if (version !== 1) {
    throw new Error(`Unsupported payload version: ${version}`)
  }
  const kindByte = walrusBytes[5]
  const iv = walrusBytes.slice(6, 18)
  const ciphertext = walrusBytes.slice(18)

  const key = await crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', false, [
    'decrypt',
  ])
  let plaintextBuf: ArrayBuffer
  try {
    plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    )
  } catch {
    throw new Error('Decryption failed. The key or ciphertext may be wrong.')
  }
  const plaintext = new Uint8Array(plaintextBuf)

  if (kindByte === 0) {
    const text = new TextDecoder().decode(plaintext)
    return { kind: 'text', text }
  }
  if (kindByte === 1) {
    const blob = new Blob([plaintext as BlobPart], { type: 'audio/webm' })
    return { kind: 'audio', blob, mimeType: 'audio/webm' }
  }
  if (kindByte === 2) {
    const blob = new Blob([plaintext as BlobPart], { type: 'video/webm' })
    return { kind: 'video', blob, mimeType: 'video/webm' }
  }
  throw new Error(`Unknown payload kind: ${kindByte}`)
}
