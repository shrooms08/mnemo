import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { useQueryClient } from '@tanstack/react-query'
import { useWizard } from './hooks'
import { sealVault, type SealPhase } from '../../lib/seal'
import { truncateAddress, formatLongDate, relativeTimeLong } from '../../lib/format'
import { contentsLabel } from '../../lib/payload'

const PHASE_PHRASE: Record<SealPhase, string> = {
  encrypting: 'Encrypting your message…',
  uploading: 'Storing on Walrus…',
  sealing: 'Sealing on Sui…',
  done: 'Sealed.',
}

function contentsLine(state: ReturnType<typeof useWizard>['state']): string {
  if (!state.plaintext) return '—'
  return contentsLabel(state.plaintext)
}

function opensLine(state: ReturnType<typeof useWizard>['state']): React.ReactNode {
  if (!state.unlockEnabled || state.unlockDateMs === null) return <>Not by date</>
  const ms = state.unlockDateMs
  const now = Date.now()
  return (
    <>
      <span className="opens-date">{formatLongDate(BigInt(ms))}</span>{' '}
      <span className="muted">
        — {ms > now ? `${relativeTimeLong(BigInt(ms - now))} from today.` : 'in the past.'}
      </span>
    </>
  )
}

function deadmanLine(state: ReturnType<typeof useWizard>['state']): string {
  if (!state.deadmanEnabled) return 'Off'
  return `On · releases if I am gone for ${state.deadmanDays} days`
}

export function SealStep() {
  const { state } = useWizard()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  const [checked, setChecked] = useState(false)
  const [phase, setPhase] = useState<SealPhase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const packageId = import.meta.env.VITE_MNEMO_PACKAGE_ID as string | undefined

  // Guard: if missing prerequisites, send the user back.
  if (!state.plaintext) return <Navigate to="/new/capture" replace />
  if (!state.recipient || !state.title || (!state.unlockEnabled && !state.deadmanEnabled)) {
    return <Navigate to="/new/configure" replace />
  }

  async function onSeal() {
    if (!packageId) {
      setError('VITE_MNEMO_PACKAGE_ID is not set. Check .env.local.')
      return
    }
    setError(null)
    try {
      const { txDigest } = await sealVault({
        signAndExecute,
        suiClient,
        packageId,
        state,
        onPhase: setPhase,
      })
      console.log('Sealed:', txDigest)
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
      // Hold "Sealed." on screen, then route home.
      setTimeout(() => navigate('/messages'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase(null)
    }
  }

  const inProgress = phase !== null && !error

  return (
    <>
      <div className="flow-head">
        <div>
          <p className="eyebrow brass">Step 3 of 3 · Seal</p>
          <h1 className="h1">Ready to seal.</h1>
          <p className="body">A last look before it goes to the vault.</p>
        </div>
        <div className="right">
          <p className="eyebrow">Estimated network fee</p>
          <p
            className="small"
            style={{ marginTop: 8, fontFamily: 'var(--mono)', color: 'var(--ink)' }}
          >
            ~0.01 SUI · ~$0.02
          </p>
        </div>
      </div>

      <div className="flow-body" style={{ paddingTop: 0 }}>
        <div className="summary-card">
          <div className="summary-row">
            <div className="k">Recipient</div>
            <div className="v">
              <span className="addr">{truncateAddress(state.recipient)}</span>
            </div>
          </div>
          <div className="summary-row">
            <div className="k">Title</div>
            <div className="v serif">{state.title}</div>
          </div>
          <div className="summary-row">
            <div className="k">Opens</div>
            <div className="v">{opensLine(state)}</div>
          </div>
          <div className="summary-row">
            <div className="k">Dead-man's switch</div>
            <div className="v">{deadmanLine(state)}</div>
          </div>
          <div className="summary-row">
            <div className="k">Contents</div>
            <div className="v">{contentsLine(state)}</div>
          </div>
          <div className="summary-row">
            <div className="k">Held by</div>
            <div className="v">
              Sui <span className="muted">·</span> stored on Walrus
            </div>
          </div>
        </div>

        <div className="seal-statement">
          <p className="h2">
            Sealing this will publish it to a public, decentralized network. Once sealed, it
            cannot be <em>edited</em>.
          </p>

          {!inProgress && (
            <label
              className={`checkbox${checked ? ' checked' : ''}`}
              onClick={() => setChecked((v) => !v)}
            >
              <span className="box" />
              <span>I understand.</span>
            </label>
          )}

          {!inProgress ? (
            <div className="seal-actions">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => navigate('/new/configure')}
              >
                ← Back
              </button>
              <button
                className="seal-btn"
                type="button"
                disabled={!checked}
                onClick={onSeal}
              >
                Seal this message
              </button>
            </div>
          ) : (
            <div className="seal-status">
              {phase && PHASE_PHRASE[phase]}
              {phase === 'uploading' && state.plaintext?.kind === 'video' && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    color: 'var(--stone)',
                  }}
                >
                  This can take a minute for video.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="seal-status">
              <span className="error">Could not seal: {error}</span>
              <button className="try-again" type="button" onClick={onSeal}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
