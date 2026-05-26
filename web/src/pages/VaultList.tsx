import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'
import { useQueryClient } from '@tanstack/react-query'
import { Transaction } from '@mysten/sui/transactions'
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'
import { useMyVaults } from '../hooks/useMyVaults'
import { AppHeader } from '../components/AppHeader'
import { VaultCard } from '../components/VaultCard'
import { EmptyState } from '../components/EmptyState'
import { addrEq, isWaitingForCheckin } from '../lib/vaults'
import { humanizeError, withTimeout } from '../lib/errors'

// 60s — see seal.ts for rationale (locked-wallet flows).
const WALLET_TIMEOUT_MS = 60_000

const FEEDBACK_MS = 3000

export function VaultList() {
  const { data: vaults, isLoading, isError, refetch } = useMyVaults()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const queryClient = useQueryClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const packageId = import.meta.env.VITE_MNEMO_PACKAGE_ID as string | undefined
  const navigate = useNavigate()
  const onSealClick = () => navigate('/new/capture')

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set())
  const [errorByVault, setErrorByVault] = useState<Record<string, string>>({})
  const [batchPending, setBatchPending] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  const sent = (vaults ?? []).filter((v) => addrEq(v.creator, account?.address))
  const waiting = sent.filter((v) => isWaitingForCheckin(v, account?.address))

  const markPending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    setErrorByVault((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })
  }, [])

  const clearPending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  const flashSuccess = useCallback((ids: string[]) => {
    setRecentIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    setTimeout(() => {
      setRecentIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, FEEDBACK_MS)
  }, [])

  const setError = useCallback((id: string, message: string) => {
    setErrorByVault((prev) => ({ ...prev, [id]: message }))
    setTimeout(() => {
      setErrorByVault((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, FEEDBACK_MS)
  }, [])

  async function runCheckin(ids: string[]): Promise<void> {
    if (!packageId) throw new Error('VITE_MNEMO_PACKAGE_ID is not set.')
    const tx = new Transaction()
    const clockArg = tx.object(SUI_CLOCK_OBJECT_ID)
    for (const id of ids) {
      tx.moveCall({
        target: `${packageId}::vault::checkin`,
        arguments: [tx.object(id), clockArg],
      })
    }
    const submitted = await withTimeout(signAndExecute({ transaction: tx }), WALLET_TIMEOUT_MS)
    if (!('digest' in submitted) || typeof submitted.digest !== 'string') {
      throw new Error('Wallet did not return a transaction digest.')
    }
    const full = await suiClient.waitForTransaction({
      digest: submitted.digest,
      options: { showEffects: true },
    })
    if (full.effects?.status?.status !== 'success') {
      throw new Error(full.effects?.status?.error ?? 'Check-in transaction failed.')
    }
  }

  async function onCheckIn(vaultId: string) {
    markPending([vaultId])
    try {
      await runCheckin([vaultId])
      clearPending([vaultId])
      flashSuccess([vaultId])
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
    } catch (e) {
      clearPending([vaultId])
      setError(vaultId, humanizeError(e))
    }
  }

  async function onCheckInAll() {
    if (waiting.length === 0) return
    const ids = waiting.map((v) => v.objectId)
    setBatchError(null)
    setBatchPending(true)
    markPending(ids)
    try {
      await runCheckin(ids)
      clearPending(ids)
      flashSuccess(ids)
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
    } catch (e) {
      clearPending(ids)
      setBatchError(humanizeError(e))
    } finally {
      setBatchPending(false)
    }
  }

  return (
    <>
      <AppHeader />

      <section className="vault-head">
        <div>
          <p className="eyebrow">Your vault</p>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Your messages.
          </h1>
          <p className="body">Messages you have sealed. They wait until their time.</p>
        </div>
        <div>
          {batchError && <p className="batch-error">{batchError}</p>}
          <div className="vault-head-actions">
            {waiting.length >= 2 && (
              <button
                className="btn-ghost-card"
                type="button"
                disabled={batchPending}
                onClick={onCheckInAll}
              >
                {batchPending ? 'Checking in to all…' : `Check in to all (${waiting.length})`}
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={onSealClick}>
              Seal a new message
            </button>
          </div>
        </div>
      </section>

      {isLoading && <div className="list-state">Reading the vault…</div>}

      {!isLoading && isError && (
        <div className="list-state">
          Could not reach the vault.
          <button className="try-again" type="button" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && sent.length === 0 && <EmptyState onSeal={onSealClick} />}

      {!isLoading && !isError && sent.length > 0 && (
        <div className="vault-list">
          {sent.map((v) => (
            <VaultCard
              key={v.objectId}
              vault={v}
              viewAs="creator"
              enableCheckin
              isCheckingIn={pendingIds.has(v.objectId)}
              isRecentlyCheckedIn={recentIds.has(v.objectId)}
              checkinError={errorByVault[v.objectId]}
              onCheckIn={() => onCheckIn(v.objectId)}
            />
          ))}
        </div>
      )}

      <footer className="tagline-footer">
        Built on Sui · Stored on Walrus · Powered by Tatum
      </footer>
    </>
  )
}
