import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isValidSuiAddress } from '@mysten/sui/utils'
import { useWizard } from './hooks'
import { formatLongDate, relativeTimeLong } from '../../lib/format'

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
  if (state.plaintext?.kind !== 'text') return ''
  const text = state.plaintext.text
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const bytes = new TextEncoder().encode(text).length + 30
  const kb = Math.max(1, Math.ceil(bytes / 1024))
  return `Letter · ${words} words · ~${kb} KB`
}

export function ConfigureStep() {
  const { state, dispatch } = useWizard()
  const navigate = useNavigate()

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

  const recipientValid = isValidSuiAddress(state.recipient.trim())
  const titleValid = state.title.trim().length > 0
  const conditionValid = state.unlockEnabled || state.deadmanEnabled
  const canContinue = recipientValid && titleValid && conditionValid

  const showRecipientError = state.recipient.length > 0 && !recipientValid

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
              <label className="field-label" htmlFor="addr-field">
                Recipient address
              </label>
              <input
                id="addr-field"
                className="input mono"
                type="text"
                placeholder="0x…"
                value={state.recipient}
                onChange={(e) =>
                  dispatch({ type: 'SET_RECIPIENT', payload: e.target.value.trim() })
                }
              />
              {showRecipientError ? (
                <p className="field-error">
                  Must be a valid Sui address — 0x followed by 64 hex characters.
                </p>
              ) : (
                <p className="field-hint">
                  The Sui address of the person who should receive this.
                </p>
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
