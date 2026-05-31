import type { VercelRequest, VercelResponse } from '@vercel/node'

const TATUM_SUI_TESTNET = 'https://sui-testnet.gateway.tatum.io'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const apiKey = process.env.TATUM_API_KEY
  if (!apiKey) {
    // Never fall through silently — a missing key must be a loud, debuggable failure.
    return res
      .status(500)
      .json({ error: 'Server misconfigured: TATUM_API_KEY is not set' })
  }

  // dapp-kit sends application/json, so Vercel parses req.body into an object.
  // Re-stringify to forward the JSON-RPC payload unchanged.
  const body =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})

  const upstream = await fetch(TATUM_SUI_TESTNET, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body,
  })

  // Return upstream status + body verbatim.
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', 'application/json')
  return res.send(text)
}
