import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { addrEq, fetchVaultById, type VaultRecord } from '../lib/vaults'
import { fetchBlob } from '../lib/walrus'
import { decryptVaultBlob, type DecryptedMessage } from '../lib/decrypt'
import { truncateAddress, formatLongDate } from '../lib/format'
import { humanizeError } from '../lib/errors'

type Stage =
  | { kind: 'loading-vault' }
  | { kind: 'fetching' }
  | { kind: 'decrypting' }
  | { kind: 'ready'; vault: VaultRecord; message: DecryptedMessage; objectUrl: string | null }
  | { kind: 'error'; title: string; hint?: string }
  | { kind: 'forbidden' }

export function Playback() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const [stage, setStage] = useState<Stage>({ kind: 'loading-vault' })

  useEffect(() => {
    if (!vaultId || !account) return
    let cancelled = false
    let objectUrl: string | null = null

    async function run() {
      try {
        setStage({ kind: 'loading-vault' })
        if (!account || !vaultId) return
        const vault = await fetchVaultById(suiClient, vaultId, account.address)
        if (cancelled) return
        if (!vault || !addrEq(vault.recipient, account.address) || vault.status === 'CANCELLED') {
          setStage({ kind: 'forbidden' })
          return
        }
        if (vault.status !== 'UNLOCKED') {
          // The contract only releases the key event-wise when unlocked.
          // We still allow decrypt attempts here since the on-chain key is readable,
          // but to keep UX honest, require UNLOCKED status before serving playback.
          setStage({ kind: 'forbidden' })
          return
        }

        setStage({ kind: 'fetching' })
        let bytes: Uint8Array
        try {
          bytes = await fetchBlob(vault.walrusBlobId)
        } catch (e) {
          if (cancelled) return
          setStage({
            kind: 'error',
            title: humanizeError(e),
            hint: 'Walrus stores blobs for a finite number of epochs. Very old messages may need re-anchoring.',
          })
          return
        }
        if (cancelled) return

        setStage({ kind: 'decrypting' })
        let message: DecryptedMessage
        try {
          message = await decryptVaultBlob(bytes, vault.encryptedKey)
        } catch {
          if (cancelled) return
          setStage({
            kind: 'error',
            title: 'We couldn’t decrypt this message.',
          })
          return
        }
        if (cancelled) return

        let url: string | null = null
        if (message.kind === 'audio' || message.kind === 'video') {
          url = URL.createObjectURL(message.blob)
          objectUrl = url
        }
        setStage({ kind: 'ready', vault, message, objectUrl: url })
      } catch (e) {
        if (cancelled) return
        setStage({ kind: 'error', title: humanizeError(e) })
      }
    }
    run()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [vaultId, account, suiClient])

  return (
    <>
      <header className="playback-header">
        <Link to="/inbox" className="wordmark">
          Mn<em>e</em>mo
        </Link>
      </header>

      <div className="playback-stage">
        {stage.kind === 'loading-vault' && (
          <div className="stage-status">Reading the vault…</div>
        )}
        {stage.kind === 'fetching' && (
          <div className="stage-status">Retrieving from Walrus…</div>
        )}
        {stage.kind === 'decrypting' && (
          <div className="stage-status">Decrypting…</div>
        )}
        {stage.kind === 'forbidden' && (
          <div className="detail-error">
            This message isn't for you, or it hasn't been opened yet.
            <Link to="/inbox">Back to inbox</Link>
          </div>
        )}
        {stage.kind === 'error' && (
          <div className="detail-error">
            {stage.title}
            {stage.hint && <span className="detail-error-hint">{stage.hint}</span>}
            <Link to="/inbox">Back to inbox</Link>
          </div>
        )}
        {stage.kind === 'ready' && (
          <>
            {stage.message.kind === 'text' && (
              <div className="text-reader">{stage.message.text}</div>
            )}
            {stage.message.kind === 'audio' && (
              <div className="media-frame audio">
                <audio src={stage.objectUrl ?? undefined} controls />
              </div>
            )}
            {stage.message.kind === 'video' && (
              <div className="media-frame">
                <video src={stage.objectUrl ?? undefined} controls playsInline />
              </div>
            )}
            <div className="playback-meta">
              <h2 className="h2">{stage.vault.title}</h2>
              <p className="small">
                {stage.message.kind === 'text' ? 'Written' : 'Recorded'} by{' '}
                <span className="name">{truncateAddress(stage.vault.creator)}</span> on{' '}
                {formatLongDate(stage.vault.createdAtMs)} &nbsp;·&nbsp; Decrypted on your device
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
