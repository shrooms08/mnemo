import type { SuiJsonRpcClient, SuiEvent, SuiObjectResponse } from '@mysten/sui/jsonRpc'

export type VaultStatus = 'SEALED' | 'UNLOCKED' | 'CANCELLED'

export type VaultRole = 'creator' | 'recipient'

export type VaultRecord = {
  objectId: string
  creator: string
  recipient: string
  title: string
  walrusBlobId: string
  encryptedKey: Uint8Array
  unlockTimeMs: bigint
  requiresCheckin: boolean
  checkinIntervalMs: bigint
  lastCheckinMs: bigint
  createdAtMs: bigint
  status: VaultStatus
  roles: VaultRole[]
  isUnlockable: boolean
}

/** Case-insensitive Sui address equality. Some RPC paths return mixed case. */
export function addrEq(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

/** True iff this vault is sealed, has a dead-man's switch, the window hasn't fired,
 *  AND the requester is the creator (only creators can check in). */
export function isWaitingForCheckin(v: VaultRecord, addr: string | undefined): boolean {
  if (!addr) return false
  if (v.status !== 'SEALED') return false
  if (!v.requiresCheckin) return false
  if (v.isUnlockable) return false
  return addrEq(v.creator, addr)
}

type SealedEventJson = {
  vault_id: string
  creator: string
  recipient: string
}

function statusFromU8(n: number): VaultStatus {
  if (n === 0) return 'SEALED'
  if (n === 1) return 'UNLOCKED'
  if (n === 2) return 'CANCELLED'
  throw new Error(`Unknown status ${n}`)
}

function computeUnlockable(
  v: Omit<VaultRecord, 'isUnlockable' | 'roles' | 'encryptedKey'>,
): boolean {
  if (v.status !== 'SEALED') return false
  const now = BigInt(Date.now())
  const timePassed = v.unlockTimeMs > 0n && now >= v.unlockTimeMs
  const deadmanFired = v.requiresCheckin && now - v.lastCheckinMs > v.checkinIntervalMs
  return timePassed || deadmanFired
}

function deriveRoles(creator: string, recipient: string, requester: string): VaultRole[] {
  const roles: VaultRole[] = []
  if (addrEq(creator, requester)) roles.push('creator')
  if (addrEq(recipient, requester)) roles.push('recipient')
  return roles
}

export function parseVaultObject(
  res: SuiObjectResponse,
  requesterAddress: string,
): VaultRecord | null {
  if (res.error || !res.data) return null
  const content = res.data.content
  if (!content || content.dataType !== 'moveObject') return null
  const f = content.fields as Record<string, unknown>

  try {
    const partial = {
      objectId: res.data.objectId,
      creator: f.creator as string,
      recipient: f.recipient as string,
      title: f.title as string,
      walrusBlobId: f.walrus_blob_id as string,
      unlockTimeMs: BigInt(f.unlock_time_ms as string),
      requiresCheckin: f.requires_checkin as boolean,
      checkinIntervalMs: BigInt(f.checkin_interval_ms as string),
      lastCheckinMs: BigInt(f.last_checkin_ms as string),
      createdAtMs: BigInt(f.created_at_ms as string),
      status: statusFromU8(Number(f.status)),
    }
    const encryptedKey = Uint8Array.from((f.encrypted_key as number[]) ?? [])
    return {
      ...partial,
      encryptedKey,
      roles: deriveRoles(partial.creator, partial.recipient, requesterAddress),
      isUnlockable: computeUnlockable(partial),
    }
  } catch (e) {
    console.warn('Failed to parse vault', res.data.objectId, e)
    return null
  }
}

async function queryAllSealedEvents(
  client: SuiJsonRpcClient,
  packageId: string,
): Promise<SuiEvent[]> {
  const out: SuiEvent[] = []
  let cursor: { txDigest: string; eventSeq: string } | null | undefined = null
  do {
    const page: Awaited<ReturnType<typeof client.queryEvents>> = await client.queryEvents({
      query: { MoveEventType: `${packageId}::vault::VaultSealed` },
      cursor,
      order: 'descending',
    })
    out.push(...page.data)
    cursor = page.hasNextPage ? page.nextCursor : null
  } while (cursor)
  return out
}

export async function fetchVaultsForAddress(
  client: SuiJsonRpcClient,
  packageId: string,
  address: string,
): Promise<VaultRecord[]> {
  const events = await queryAllSealedEvents(client, packageId)

  const ids = new Set<string>()
  for (const ev of events) {
    const parsed = ev.parsedJson as SealedEventJson | undefined
    if (!parsed?.vault_id) continue
    if (addrEq(parsed.creator, address) || addrEq(parsed.recipient, address)) {
      ids.add(parsed.vault_id)
    }
  }
  if (ids.size === 0) return []

  const objects = await client.multiGetObjects({
    ids: [...ids],
    options: { showContent: true },
  })

  const records: VaultRecord[] = []
  for (const res of objects) {
    const rec = parseVaultObject(res, address)
    if (rec) records.push(rec)
  }

  records.sort((a, b) =>
    a.createdAtMs === b.createdAtMs ? 0 : a.createdAtMs > b.createdAtMs ? -1 : 1,
  )
  return records
}

export async function fetchVaultById(
  client: SuiJsonRpcClient,
  vaultId: string,
  requesterAddress: string,
): Promise<VaultRecord | null> {
  const res = await client.getObject({ id: vaultId, options: { showContent: true } })
  return parseVaultObject(res, requesterAddress)
}
