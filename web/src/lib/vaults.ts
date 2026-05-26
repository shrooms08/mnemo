import type { SuiJsonRpcClient, SuiEvent } from '@mysten/sui/jsonRpc'

export type VaultStatus = 'SEALED' | 'UNLOCKED' | 'CANCELLED'

export type VaultRecord = {
  objectId: string
  creator: string
  recipient: string
  title: string
  walrusBlobId: string
  unlockTimeMs: bigint
  requiresCheckin: boolean
  checkinIntervalMs: bigint
  lastCheckinMs: bigint
  createdAtMs: bigint
  status: VaultStatus
  role: 'creator' | 'recipient'
  isUnlockable: boolean
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

function computeUnlockable(v: Omit<VaultRecord, 'isUnlockable' | 'role'>): boolean {
  if (v.status !== 'SEALED') return false
  const now = BigInt(Date.now())
  const timePassed = v.unlockTimeMs > 0n && now >= v.unlockTimeMs
  const deadmanFired = v.requiresCheckin && now - v.lastCheckinMs > v.checkinIntervalMs
  return timePassed || deadmanFired
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

  const roleByVaultId = new Map<string, 'creator' | 'recipient'>()
  for (const ev of events) {
    const parsed = ev.parsedJson as SealedEventJson | undefined
    if (!parsed?.vault_id) continue
    if (parsed.creator === address) {
      roleByVaultId.set(parsed.vault_id, 'creator')
    } else if (parsed.recipient === address && !roleByVaultId.has(parsed.vault_id)) {
      roleByVaultId.set(parsed.vault_id, 'recipient')
    }
  }
  const ids = [...roleByVaultId.keys()]
  if (ids.length === 0) return []

  const objects = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  })

  const records: VaultRecord[] = []
  for (const res of objects) {
    if (res.error || !res.data) {
      console.warn('Skipping vault object', res)
      continue
    }
    const content = res.data.content
    if (!content || content.dataType !== 'moveObject') {
      console.warn('Skipping non-move-object', res.data.objectId)
      continue
    }
    const f = content.fields as Record<string, unknown>
    try {
      const objectId = res.data.objectId
      const role = roleByVaultId.get(objectId) ?? 'creator'
      const partial = {
        objectId,
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
      records.push({
        ...partial,
        role,
        isUnlockable: computeUnlockable(partial),
      })
    } catch (e) {
      console.warn('Failed to parse vault', res.data.objectId, e)
    }
  }

  records.sort((a, b) =>
    a.createdAtMs === b.createdAtMs ? 0 : a.createdAtMs > b.createdAtMs ? -1 : 1,
  )
  return records
}
