import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { Transaction } from '@mysten/sui/transactions'
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'
import type { useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import type { WizardState } from '../pages/NewMessage/state'
import { encryptForVault } from './crypto'
import { uploadBlob } from './walrus'
import { withTimeout } from './errors'

const WALLET_TIMEOUT_MS = 30_000

export type SealPhase = 'encrypting' | 'uploading' | 'sealing' | 'done'

type SignAndExecute = ReturnType<typeof useSignAndExecuteTransaction>['mutateAsync']

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MIN_PHASE_MS = 600

async function withMinDuration<T>(p: Promise<T>): Promise<T> {
  const [value] = await Promise.all([p, sleep(MIN_PHASE_MS)])
  return value
}

const DAY_MS = 86_400_000n

export async function sealVault(args: {
  signAndExecute: SignAndExecute
  suiClient: SuiJsonRpcClient
  packageId: string
  state: WizardState
  onPhase: (phase: SealPhase) => void
}): Promise<{ vaultId: string; txDigest: string }> {
  const { signAndExecute, suiClient, packageId, state, onPhase } = args
  if (!state.plaintext) throw new Error('No plaintext to seal')

  onPhase('encrypting')
  const { payload, rawKey } = await withMinDuration(encryptForVault(state.plaintext))

  onPhase('uploading')
  const blobId = await withMinDuration(uploadBlob(payload))

  onPhase('sealing')
  const unlockTimeMs =
    state.unlockEnabled && state.unlockDateMs !== null ? BigInt(state.unlockDateMs) : 0n
  const checkinIntervalMs = state.deadmanEnabled ? BigInt(state.deadmanDays) * DAY_MS : 0n

  const tx = new Transaction()
  tx.moveCall({
    target: `${packageId}::vault::seal_vault`,
    arguments: [
      tx.pure.address(state.recipient.trim()),
      tx.pure.string(blobId),
      tx.pure.vector('u8', Array.from(rawKey)),
      tx.pure.string(state.title.trim()),
      tx.pure.u64(unlockTimeMs),
      tx.pure.bool(state.deadmanEnabled),
      tx.pure.u64(checkinIntervalMs),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  const submitted = await withTimeout(signAndExecute({ transaction: tx }), WALLET_TIMEOUT_MS)
  if (!('digest' in submitted) || typeof submitted.digest !== 'string') {
    throw new Error('Wallet did not return a transaction digest')
  }
  const digest = submitted.digest

  // The dapp-kit wallet hook only returns { digest } by default; fetch full effects.
  const full = await withMinDuration(
    suiClient.waitForTransaction({
      digest,
      options: { showEffects: true, showObjectChanges: true },
    }),
  )

  if (full.effects?.status?.status !== 'success') {
    throw new Error(`Seal tx failed: ${full.effects?.status?.error ?? 'unknown'}`)
  }

  const created = full.objectChanges?.find(
    (c) => c.type === 'created' && c.objectType === `${packageId}::vault::Vault`,
  )
  const vaultId = created && 'objectId' in created ? created.objectId : ''

  onPhase('done')
  return { vaultId, txDigest: full.digest }
}
