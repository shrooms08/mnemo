import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Transaction } from '@mysten/sui/transactions'
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'
import { AppHeader } from '../components/AppHeader'
import { addrEq, fetchVaultById, type VaultRecord } from '../lib/vaults'
import { truncateAddress, formatLongDate, relativeTimeLong } from '../lib/format'
import { humanizeError, withTimeout } from '../lib/errors'

const WALLET_TIMEOUT_MS = 30_000

type UnlockPhase = 'opening' | 'decrypting' | 'ready'

const PHRASE: Record<UnlockPhase, string> = {
  opening: 'Opening…',
  decrypting: 'Decrypting…',
  ready: 'Ready.',
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function firstChar(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return '·'
  const c = [...trimmed][0]
  return /[a-zA-Z]/.test(c) ? c.toUpperCase() : c
}

function countdownText(v: VaultRecord, now: bigint): string {
  const hasTime = v.unlockTimeMs > 0n
  if (hasTime && v.unlockTimeMs > now) {
    return `Opens in ${relativeTimeLong(v.unlockTimeMs - now)}.`
  }
  if (!hasTime && v.requiresCheckin) {
    return 'Opens when the sender goes silent.'
  }
  return 'Opens soon.'
}

export function InboxDetail() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const packageId = import.meta.env.VITE_MNEMO_PACKAGE_ID as string | undefined

  const [phase, setPhase] = useState<UnlockPhase | null>(null)
  const [error, setError] = useState<string | null>(null)

  const address = account?.address ?? ''
  const {
    data: vault,
    isLoading,
    isError,
  } = useQuery<VaultRecord | null>({
    queryKey: ['vault', vaultId, address],
    queryFn: () => fetchVaultById(suiClient, vaultId!, address),
    enabled: !!vaultId && !!address,
    staleTime: 15_000,
  })

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="list-state">Reading the vault…</div>
      </>
    )
  }

  const isForYou = !!vault && addrEq(vault.recipient, account?.address)
  const isAccessible = vault && vault.status !== 'CANCELLED' && isForYou

  if (isError || !vault || !isAccessible) {
    return (
      <>
        <AppHeader />
        <div className="detail-error">
          This message isn't for you, or no longer exists.
          <Link to="/inbox">Back to inbox</Link>
        </div>
      </>
    )
  }

  const now = BigInt(Date.now())
  const isReady = vault.isUnlockable
  const isUnlocked = vault.status === 'UNLOCKED'

  async function onUnlock() {
    if (!packageId || !vault) return
    setError(null)
    const tx = new Transaction()
    tx.moveCall({
      target: `${packageId}::vault::unlock`,
      arguments: [tx.object(vault.objectId), tx.object(SUI_CLOCK_OBJECT_ID)],
    })
    try {
      setPhase('opening')
      const submitted = await withTimeout(
        signAndExecute({ transaction: tx }),
        WALLET_TIMEOUT_MS,
      )
      if (!('digest' in submitted) || typeof submitted.digest !== 'string') {
        throw new Error('Wallet did not return a transaction digest.')
      }
      const full = await suiClient.waitForTransaction({
        digest: submitted.digest,
        options: { showEffects: true },
      })
      if (full.effects?.status?.status !== 'success') {
        throw new Error(full.effects?.status?.error ?? 'Unlock transaction failed.')
      }
      await sleep(600) // hold "Opening…"
      setPhase('decrypting')
      await sleep(600)
      setPhase('ready')
      await sleep(600)
      queryClient.invalidateQueries({ queryKey: ['vault', vault.objectId] })
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
      navigate(`/inbox/${vault.objectId}/open`)
    } catch (e) {
      setError(humanizeError(e))
      setPhase(null)
    }
  }

  const t = isUnlocked || isReady ? 'sage' : 'brass'
  const eyebrowText = isUnlocked
    ? 'Already opened'
    : isReady
      ? 'Ready to be opened'
      : 'A message is waiting for you'
  const eyebrowClass = isUnlocked ? 'stone' : isReady ? 'sage' : 'brass'

  const showWaiting = !isReady && !isUnlocked
  const showReady = isReady && !isUnlocked
  const showAlreadyUnlocked = isUnlocked

  return (
    <>
      <AppHeader />
      <div className="recipient-stage">
        <div className={`seal-ornament ${t}`} aria-hidden="true">
          {firstChar(vault.title)}
        </div>
        <p className={`eyebrow ${eyebrowClass}`}>{eyebrowText}</p>
        <h1 className="display">{vault.title}</h1>
        <p className="from">
          From <span className="name">{truncateAddress(vault.creator)}</span> &nbsp;·&nbsp; sealed{' '}
          {formatLongDate(vault.createdAtMs)}
        </p>

        {showWaiting && (
          <>
            <p className="countdown">{countdownText(vault, now)}</p>
            {vault.unlockTimeMs > 0n && (
              <p className="countdown-date">{formatLongDate(vault.unlockTimeMs)}</p>
            )}
            {vault.unlockTimeMs > 0n && vault.requiresCheckin && (
              <p className="countdown-footnote">Or earlier, if they go silent.</p>
            )}
            <p className="recipient-note">
              This message is encrypted. Only you can open it, when its time comes.
            </p>
          </>
        )}

        {showReady && phase === null && (
          <>
            <button className="open-invitation" type="button" onClick={onUnlock}>
              Open the message
            </button>
            <p className="recipient-note">Once opened, this is yours to keep.</p>
          </>
        )}

        {showAlreadyUnlocked && (
          <>
            <Link to={`/inbox/${vault.objectId}/open`} className="open-invitation">
              Open the message
            </Link>
            <p className="recipient-note">You've opened this before. It's still yours.</p>
          </>
        )}

        {phase !== null && !error && <div className="unlock-status">{PHRASE[phase]}</div>}

        {error && (
          <div className="unlock-status">
            <span className="error">{error}</span>
            <button className="try-again" type="button" onClick={onUnlock}>
              Try again
            </button>
          </div>
        )}

        <p style={{ marginTop: 64 }}>
          <Link
            to="/inbox"
            style={{
              fontSize: 13,
              color: 'var(--stone)',
              borderBottom: '1px solid var(--mist)',
              paddingBottom: 2,
              textDecoration: 'none',
            }}
          >
            Back to inbox
          </Link>
        </p>
      </div>
    </>
  )
}
