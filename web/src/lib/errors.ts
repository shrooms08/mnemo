/** Map low-level wallet / RPC / fetch error messages to the product's voice.
 *  Keep the result ≤ 20 words. Never leak stack traces or HTTP bodies. */
export function humanizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()

  // User-initiated rejection from the wallet popup.
  if (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('user declined') ||
    lower.includes('user denied') ||
    lower.includes('cancelled by user')
  ) {
    return 'You declined the signature.'
  }

  // Our own timeout sentinel.
  if (lower.includes('wallet timeout')) {
    return "Your wallet didn't respond. Make sure it's unlocked and try again."
  }

  // Walrus upload paths.
  if (lower.includes('walrus upload failed') || lower.includes('walrus response missing')) {
    return 'Walrus couldn’t accept the upload. Trying again may help.'
  }
  if (lower.includes('could not retrieve from walrus')) {
    return 'We couldn’t retrieve this message. It may have expired from storage.'
  }

  // Generic network failure.
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return 'We couldn’t reach the network. Check your connection and try again.'
  }

  // RPC / chain errors.
  if (lower.includes('jsonrpc') || lower.includes('rpc error')) {
    return 'The Sui network is having trouble. Try again in a moment.'
  }

  // Fallback: short, generic.
  return 'Something went wrong. Try again.'
}

/** Wrap a promise with a timeout. Rejects with a tagged Error after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, tag = 'wallet timeout'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(tag)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
