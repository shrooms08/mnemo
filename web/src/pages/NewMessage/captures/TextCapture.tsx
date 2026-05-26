import { useEffect, useState } from 'react'
import { useWizard } from '../hooks'

function wordCount(s: string): number {
  const trimmed = s.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function estimatedKb(s: string): number {
  const bytes = new TextEncoder().encode(s).length + 30
  return Math.max(1, Math.ceil(bytes / 1024))
}

export function TextCapture() {
  const { state, dispatch } = useWizard()
  const initial = state.plaintext?.kind === 'text' ? state.plaintext.text : ''
  const [text, setText] = useState(initial)

  // Keep wizard state in sync as the user types, so Continue can read it directly.
  useEffect(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    dispatch({ type: 'SET_PLAINTEXT', payload: { kind: 'text', text: trimmed } })
  }, [text, dispatch])

  const otherKind =
    state.plaintext && state.plaintext.kind !== 'text' ? state.plaintext.kind : null

  return (
    <>
      <textarea
        className="letter-area"
        placeholder="Begin writing…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="capture-meta">
        <span>
          {wordCount(text)} words · ~{estimatedKb(text)} KB encrypted
        </span>
      </div>
      {otherKind && (
        <p className="replaces-note">
          Writing here will replace the {otherKind} you recorded.
        </p>
      )}
    </>
  )
}
