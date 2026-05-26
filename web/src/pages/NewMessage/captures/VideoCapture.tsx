import { useEffect, useRef, useState } from 'react'
import { useWizard } from '../hooks'
import { createRecorder, type RecordingHandle } from '../../../lib/recording'

type Phase =
  | { kind: 'idle' }
  | { kind: 'ready'; handle: RecordingHandle }
  | { kind: 'recording'; handle: RecordingHandle; startedAt: number }
  | { kind: 'done'; blob: Blob; durationMs: number; objectUrl: string }

const MAX_MS = 60_000

function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function VideoCapture() {
  const { state, dispatch } = useWizard()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const liveRef = useRef<HTMLVideoElement | null>(null)

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const p = phaseRef.current
      if (p.kind === 'ready' || p.kind === 'recording') p.handle.cancel()
      if (p.kind === 'done') URL.revokeObjectURL(p.objectUrl)
    }
  }, [])

  // Bind the live stream to the preview video element when in ready/recording.
  useEffect(() => {
    if (phase.kind === 'ready' || phase.kind === 'recording') {
      if (liveRef.current && liveRef.current.srcObject !== phase.handle.stream) {
        liveRef.current.srcObject = phase.handle.stream
      }
    }
  }, [phase])

  // Timer tick while recording.
  useEffect(() => {
    if (phase.kind !== 'recording') return
    let raf = 0
    const tick = () => {
      setElapsed(performance.now() - phase.startedAt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  async function enableCamera() {
    setError(null)
    try {
      const handle = await createRecorder({ kind: 'video', maxDurationMs: MAX_MS })
      setPhase({ kind: 'ready', handle })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function startRecording() {
    if (phase.kind !== 'ready') return
    phase.handle.start()
    setPhase({ kind: 'recording', handle: phase.handle, startedAt: performance.now() })
  }

  async function stopRecording() {
    if (phase.kind !== 'recording') return
    try {
      const { blob, durationMs } = await phase.handle.stop()
      const objectUrl = URL.createObjectURL(blob)
      setPhase({ kind: 'done', blob, durationMs, objectUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase({ kind: 'idle' })
    }
  }

  function rerecord() {
    if (phase.kind === 'done') URL.revokeObjectURL(phase.objectUrl)
    setPhase({ kind: 'idle' })
    setElapsed(0)
  }

  function useThis() {
    if (phase.kind !== 'done') return
    dispatch({
      type: 'SET_PLAINTEXT',
      payload: { kind: 'video', blob: phase.blob, durationMs: phase.durationMs },
    })
  }

  const otherKind =
    state.plaintext && state.plaintext.kind !== 'video' ? state.plaintext.kind : null

  return (
    <>
      <div className="viewport">
        {phase.kind === 'idle' && (
          <>
            <div className="corner tl">
              <span className="rec-dot" /> Camera · Ready
            </div>
            <div className="corner tr">640 × 480</div>
            <div className="corner bl">Encrypted in-browser</div>
            <div className="corner br">Mic · Built-in</div>
            <div className="silhouette" />
            <p className="viewport-prompt" style={{ position: 'absolute' }}>
              Tap to enable camera.
              <br />
              <button
                className="link-primary"
                type="button"
                onClick={enableCamera}
                style={{ marginTop: 16 }}
              >
                Enable camera <span className="arrow">→</span>
              </button>
            </p>
          </>
        )}
        {(phase.kind === 'ready' || phase.kind === 'recording') && (
          <>
            <video ref={liveRef} autoPlay playsInline muted />
            <div className="corner tl">
              {phase.kind === 'recording' ? (
                <>
                  <span className="rec-dot live" /> Recording
                </>
              ) : (
                <>
                  <span className="rec-dot" /> Camera · Ready
                </>
              )}
            </div>
            <div className="corner tr">640 × 480</div>
            <div className="corner bl">Encrypted in-browser</div>
            <div className="corner br">Mic · Built-in</div>
          </>
        )}
        {phase.kind === 'done' && (
          <video src={phase.objectUrl} controls playsInline />
        )}
      </div>

      <div className="record-controls">
        <div className="timer">
          <span className="label">Duration</span>
          {phase.kind === 'recording'
            ? fmtTime(elapsed)
            : phase.kind === 'done'
              ? fmtTime(phase.durationMs)
              : '00:00'}
        </div>
        {phase.kind === 'done' ? (
          <div className="playback-row">
            <button className="rerecord-link" type="button" onClick={rerecord}>
              ↻ Re-record
            </button>
            <button className="btn btn-primary" type="button" onClick={useThis}>
              Use this
            </button>
          </div>
        ) : (
          <button
            className={`record-btn${phase.kind === 'recording' ? ' recording' : ''}`}
            type="button"
            aria-label={phase.kind === 'recording' ? 'Stop recording' : 'Start recording'}
            disabled={phase.kind === 'idle'}
            onClick={phase.kind === 'recording' ? stopRecording : startRecording}
          />
        )}
        <div className="timer right">
          <span className="label">Max</span>
          {fmtTime(MAX_MS)}
        </div>
      </div>

      {error && <p className="permission-error">{error}</p>}
      {otherKind && phase.kind === 'idle' && (
        <p className="replaces-note">
          Recording here will replace the {otherKind} you captured.
        </p>
      )}
    </>
  )
}
