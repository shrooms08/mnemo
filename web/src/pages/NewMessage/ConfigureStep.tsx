import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isValidSuiAddress } from '@mysten/sui/utils'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useWizard } from './hooks'
import { formatLongDate, looksUnusualAddress, relativeTimeLong } from '../../lib/format'
import { addrEq } from '../../lib/vaults'
import { capturedLabel } from '../../lib/payload'

type HistoryStatus = 'empty' | 'has' | 'unknown'

function defaultUnlockMs(): number {
  // 1 year from today, normalized to midnight UTC.
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

function dateInputValue(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function captureMetaLabel(state: ReturnType<typeof useWizard>['state']): string {
  if (!state.plaintext) return ''
  return capturedLabel(state.plaintext)
}

export function ConfigureStep() {
  const { state, dispatch } = useWizard()
  const navigate = useNavigate()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()

  // Guard: if no plaintext captured, send back to step 1.
  if (!state.plaintext) return <Navigate to="/new/capture" replace />

  // Seed unlock date the first time the toggle is on but no date exists.
  useEffect(() => {
    if (state.unlockEnabled && state.unlockDateMs === null) {
      dispatch({ type: 'SET_UNLOCK_DATE', payload: defaultUnlockMs() })
    }
  }, [state.unlockEnabled, state.unlockDateMs, dispatch])

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [editingDays, setEditingDays] = useState(false)
  // Per-address session cache of on-chain history check results.
  const historyCacheRef = useRef<Map<string, HistoryStatus>>(new Map())
  // Re-render trigger so cache mutation surfaces a new warning state.
  const [, forceRender] = useState(0)

  const trimmedRecipient = state.recipient.trim()
  const recipientValid = isValidSuiAddress(trimmedRecipient)
  const titleValid = state.title.trim().length > 0
  const conditionValid = state.unlockEnabled || state.deadmanEnabled
  const canContinue = recipientValid && titleValid && conditionValid

  const showRecipientError = state.recipient.length > 0 && !recipientValid
  const isSelfSeal = recipientValid && addrEq(trimmedRecipient, account?.address)
  const looksUnusual = recipientValid && !isSelfSeal && looksUnusualAddress(trimmedRecipient)
  const historyStatus: HistoryStatus =
    recipientValid && !isSelfSeal
      ? (historyCacheRef.current.get(trimmedRecipient.toLowerCase()) ?? 'unknown')
      : 'unknown'
  const showNoHistoryWarning = historyStatus === 'empty'

  async function checkHistoryOnBlur() {
    if (!recipientValid || isSelfSeal) return
    const key = trimmedRecipient.toLowerCase()
    if (historyCacheRef.current.has(key)) return
    try {
      const balances = await suiClient.getAllBalances({ owner: trimmedRecipient })
      historyCacheRef.current.set(key, balances.length === 0 ? 'empty' : 'has')
    } catch {
      // Network/RPC failure — silently skip. Never block on this signal.
      historyCacheRef.current.set(key, 'unknown')
    }
    forceRender((n) => n + 1)
  }

  function useMyAddress() {
    if (!account?.address) return
    dispatch({ type: 'SET_RECIPIENT', payload: account.address })
  }

  const now = Date.now()
  const relPhrase =
    state.unlockEnabled && state.unlockDateMs !== null && state.unlockDateMs > now
      ? relativeTimeLong(BigInt(state.unlockDateMs - now))
      : null

  function onContinue() {
    if (!canContinue) return
    navigate('/new/seal')
  }

  return (
    <>
      <div className="flow-head">
        <div>
          <p className="eyebrow brass">Step 2 of 3 · Who and when</p>
          <h1 className="h1">Who is this for, and when should it open?</h1>
        </div>
        <div className="right">
          <p className="eyebrow">Message captured</p>
          <p className="small" style={{ marginTop: 8 }}>
            {captureMetaLabel(state)}
          </p>
        </div>
      </div>

      <div className="configure">
        {/* Recipient */}
        <div className="config-section">
          <div>
            <h3>Recipient</h3>
            <p className="h-note">
              Who will receive this. You can change this until the message is sealed.
            </p>
          </div>
          <div>
            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="addr-field">
                  Recipient address
                </label>
                {account?.address && (
                  <button
                    type="button"
                    className="use-my-address"
                    onClick={useMyAddress}
                  >
                    Use my address
                  </button>
                )}
              </div>
              <input
                id="addr-field"
                className="input mono"
                type="text"
                placeholder="0x…"
                value={state.recipient}
                onChange={(e) =>
                  dispatch({ type: 'SET_RECIPIENT', payload: e.target.value.trim() })
                }
                onBlur={checkHistoryOnBlur}
              />
              {showRecipientError ? (
                <p className="field-error">
                  Must be a valid Sui address — 0x followed by 64 hex characters.
                </p>
              ) : (
                <>
                  {(looksUnusual || showNoHistoryWarning) && (
                    <ul className="field-warnings">
                      {looksUnusual && (
                        <li>· This address looks unusual. Double-check the recipient.</li>
                      )}
                      {showNoHistoryWarning && (
                        <li>
                          · This address has no on-chain history yet. They may not have a
                          wallet.
                        </li>
                      )}
                    </ul>
                  )}
                  {isSelfSeal ? (
                    <p className="field-hint self-seal">You're sealing this to yourself.</p>
                  ) : (
                    <p className="field-hint">
                      The Sui address of the person who should receive this.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="title-field">
                Title <span className="muted">— visible to you only, not encrypted</span>
              </label>
              <input
                id="title-field"
                className="input"
                type="text"
                placeholder="For Eliza, on her eighteenth birthday"
                value={state.title}
                onChange={(e) => dispatch({ type: 'SET_TITLE', payload: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Time lock */}
        <div className="config-section">
          <div>
            <h3>Open on a specific date</h3>
            <p className="h-note">
              The earliest moment the message can be opened. Cannot be moved earlier once sealed.
            </p>
          </div>
          <div>
            <div className="toggle" role="group" aria-label="Time lock">
              <button
                type="button"
                className={`opt${state.unlockEnabled ? '' : ' on'}`}
                onClick={() => dispatch({ type: 'TOGGLE_UNLOCK', payload: false })}
              >
                Off
              </button>
              <button
                type="button"
                className={`opt${state.unlockEnabled ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'TOGGLE_UNLOCK', payload: true })}
              >
                On
              </button>
            </div>
            {state.unlockEnabled && state.unlockDateMs !== null && (
              <>
                <div className="date-display">
                  {showDatePicker ? (
                    <input
                      type="date"
                      autoFocus
                      value={dateInputValue(state.unlockDateMs)}
                      onChange={(e) => {
                        const ms = Date.parse(e.target.value + 'T00:00:00Z')
                        if (!Number.isNaN(ms)) {
                          dispatch({ type: 'SET_UNLOCK_DATE', payload: ms })
                        }
                      }}
                      onBlur={() => setShowDatePicker(false)}
                    />
                  ) : (
                    <>
                      <p className="date">{formatLongDate(BigInt(state.unlockDateMs))}</p>
                      <button
                        type="button"
                        className="change"
                        onClick={() => setShowDatePicker(true)}
                      >
                        Change date
                      </button>
                    </>
                  )}
                </div>
                <p className="field-hint" style={{ marginTop: 16 }}>
                  Earliest moment this can be opened.{' '}
                  {relPhrase && <em>{relPhrase} from today.</em>}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Dead-man's switch */}
        <div className="config-section">
          <div>
            <h3>Release if I go silent</h3>
            <p className="h-note">
              A quiet check-in. If you stop responding, this message will release itself.
            </p>
          </div>
          <div>
            <div className="toggle" role="group" aria-label="Dead-man's switch">
              <button
                type="button"
                className={`opt${state.deadmanEnabled ? '' : ' on'}`}
                onClick={() => dispatch({ type: 'TOGGLE_DEADMAN', payload: false })}
              >
                Off
              </button>
              <button
                type="button"
                className={`opt${state.deadmanEnabled ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'TOGGLE_DEADMAN', payload: true })}
              >
                On
              </button>
            </div>
            {state.deadmanEnabled && (
              <>
                <p className="switch-sentence">
                  Release if I have not checked in for{' '}
                  {editingDays ? (
                    <input
                      type="number"
                      className="num-input"
                      min={1}
                      max={3650}
                      autoFocus
                      value={state.deadmanDays}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        if (!Number.isNaN(n) && n > 0) {
                          dispatch({ type: 'SET_DEADMAN_DAYS', payload: n })
                        }
                      }}
                      onBlur={() => setEditingDays(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingDays(false)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="num"
                      onClick={() => setEditingDays(true)}
                    >
                      {state.deadmanDays}
                    </button>
                  )}{' '}
                  days.
                </p>
                <p className="field-hint" style={{ marginTop: 16 }}>
                  You'll receive reminders to check in. If you stop, the message will be released
                  — whether or not the date above has passed.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="product-line">
          <p>
            Once a message is sealed, it cannot be edited or opened until its appointed time. You
            can change who receives it; you cannot change <em>what it says</em>.
          </p>
        </div>
      </div>

      <div className="flow-footer">
        <button className="btn-ghost" type="button" onClick={() => navigate('/new/capture')}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </>
  )
}
