import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizard } from './hooks'

function wordCount(s: string): number {
  const trimmed = s.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function estimatedKb(s: string): number {
  // UTF-8 bytes + ~30B header/IV/tag overhead, rounded up to KB, min 1.
  const bytes = new TextEncoder().encode(s).length + 30
  return Math.max(1, Math.ceil(bytes / 1024))
}

export function CaptureStep() {
  const { state, dispatch } = useWizard()
  const navigate = useNavigate()
  const initialText = state.plaintext?.kind === 'text' ? state.plaintext.text : ''
  const [text, setText] = useState(initialText)

  const trimmedLength = text.trim().length
  const canContinue = trimmedLength > 0

  function onContinue() {
    if (!canContinue) return
    dispatch({ type: 'SET_PLAINTEXT', payload: { kind: 'text', text: text.trim() } })
    navigate('/new/configure')
  }

  return (
    <>
      <div className="flow-head">
        <div>
          <p className="eyebrow brass">Step 1 of 3 · Capture</p>
          <h1 className="h1">Write your message.</h1>
          <p className="body">
            Take your time. This will be encrypted on your device before it leaves.
          </p>
        </div>
        <div className="right">
          <p className="eyebrow">Recipient (TBD)</p>
          <p className="small" style={{ marginTop: 8 }}>
            You'll choose who this is for next.
          </p>
        </div>
      </div>

      <div className="flow-body">
        <div className="tabs" role="tablist">
          <button className="tab" type="button" disabled title="Coming soon">
            Video
          </button>
          <button className="tab" type="button" disabled title="Coming soon">
            Audio
          </button>
          <button className="tab is-active" type="button">
            Letter
          </button>
        </div>

        <textarea
          className="letter-area"
          placeholder="Begin writing…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <div className="capture-meta">
          <span>{wordCount(text)} words · ~{estimatedKb(text)} KB encrypted</span>
        </div>

        <p className="privacy-note">Encrypted on this device. Never seen by us.</p>
      </div>

      <div className="flow-footer">
        <button className="btn-ghost" type="button" onClick={() => navigate('/messages')}>
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
