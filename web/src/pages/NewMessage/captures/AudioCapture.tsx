import { useEffect, useRef, useState } from 'react'
import { useWizard } from '../hooks'
import { createRecorder, type RecordingHandle } from '../../../lib/recording'

type Phase =
  | { kind: 'idle' }
  | { kind: 'recording'; handle: RecordingHandle; startedAt: number }
  | { kind: 'done'; blob: Blob; durationMs: number; objectUrl: string }

const MAX_MS = 300_000
const BAR_COUNT = 8

function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AudioCapture() {
  const { state, dispatch } = useWizard()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [levels, setLevels] = useState<number[]>(new Array(BAR_COUNT).fill(0))

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Cleanup on unmount: cancel active recording, revoke blob URL.
  useEffect(() => {
    return () => {
      const p = phaseRef.current
      if (p.kind === 'recording') p.handle.cancel()
      if (p.kind === 'done') URL.revokeObjectURL(p.objectUrl)
    }
  }, [])

  // RAF loop while recording: drives timer + analyser.
  useEffect(() => {
    if (phase.kind !== 'recording') return
    let raf = 0
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(phase.handle.stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      const now = performance.now()
      setElapsed(now - phase.startedAt)
      analyser.getByteFrequencyData(data)
      // Average loudness 0..255 → integer 0..BAR_COUNT.
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length
      const lit = Math.min(BAR_COUNT, Math.floor((avg / 255) * BAR_COUNT * 2.5))
      setLevels((prev) => prev.map((_, i) => (i < lit ? 1 : 0)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audioCtx.close().catch(() => {})
    }
  }, [phase])

  async function startRecording() {
    setError(null)
    try {
      const handle = await createRecorder({ kind: 'audio', maxDurationMs: MAX_MS })
      handle.start()
      setPhase({ kind: 'recording', handle, startedAt: performance.now() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
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
      payload: { kind: 'audio', blob: phase.blob, durationMs: phase.durationMs },
    })
  }

  const otherKind =
    state.plaintext && state.plaintext.kind !== 'audio' ? state.plaintext.kind : null

  return (
    <>
      <div className="viewport audio">
        {phase.kind === 'idle' && (
          <p className="viewport-prompt">Tap record to begin.</p>
        )}
        {phase.kind === 'recording' && (
          <div style={{ textAlign: 'center' }}>
            <p className="viewport-prompt" style={{ marginBottom: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--brass)',
                    animation: 'rec-pulse 1.2s ease-in-out infinite',
                  }}
                />
                Recording
              </span>
            </p>
            <div className="amp-meter" aria-hidden="true">
              {levels.map((lit, i) => (
                <span
                  key={i}
                  className={`bar${lit ? ' lit' : ''}`}
                  style={{ height: `${8 + lit * 14}px` }}
                />
              ))}
            </div>
          </div>
        )}
        {phase.kind === 'done' && (
          <div className="playback-block">
            <audio src={phase.objectUrl} controls />
          </div>
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
