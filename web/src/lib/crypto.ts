import type { Plaintext } from '../pages/NewMessage/state'

export type EncryptedPayload = {
  payload: Uint8Array
  rawKey: Uint8Array
}

const MAGIC = new Uint8Array([0x4d, 0x4e, 0x4d, 0x4f]) // "MNMO"
const VERSION = 1

// Payload kind byte. Recipients use this to pick a MIME type for playback:
//   0 -> text (UTF-8)
//   1 -> audio (audio/webm)
//   2 -> video (video/webm)
function kindCode(kind: Plaintext['kind']): number {
  if (kind === 'text') return 0
  if (kind === 'audio') return 1
  return 2
}

async function plaintextBytes(p: Plaintext): Promise<Uint8Array> {
  if (p.kind === 'text') return new TextEncoder().encode(p.text)
  return new Uint8Array(await p.blob.arrayBuffer())
}

export async function encryptForVault(plaintext: Plaintext): Promise<EncryptedPayload> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const bytes = await plaintextBytes(plaintext)
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    bytes as BufferSource,
  )
  const cipher = new Uint8Array(cipherBuf)

  // Header: 4B magic + 1B version + 1B kind + 12B IV = 18 bytes
  const payload = new Uint8Array(18 + cipher.length)
  payload.set(MAGIC, 0)
  payload[4] = VERSION
  payload[5] = kindCode(plaintext.kind)
  payload.set(iv, 6)
  payload.set(cipher, 18)

  const rawKeyBuf = await crypto.subtle.exportKey('raw', key)
  return { payload, rawKey: new Uint8Array(rawKeyBuf) }
}
