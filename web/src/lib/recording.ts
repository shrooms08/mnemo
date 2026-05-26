export type RecordingResult = {
  blob: Blob
  durationMs: number
}

export type RecordingHandle = {
  stream: MediaStream
  mimeType: string
  start(): void
  stop(): Promise<RecordingResult>
  cancel(): void
}

const AUDIO_MIME = 'audio/webm;codecs=opus'
const VIDEO_MIME = 'video/webm;codecs=vp8,opus'

function friendlyPermissionError(err: unknown): Error {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return new Error(
        'Camera and microphone access was denied. Enable it in your browser settings and try again.',
      )
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return new Error('No microphone or camera was detected on this device.')
    }
    if (err.name === 'NotReadableError') {
      return new Error('Another app is using the microphone or camera. Close it and try again.')
    }
  }
  return err instanceof Error ? err : new Error(String(err))
}

export async function createRecorder(opts: {
  kind: 'audio' | 'video'
  maxDurationMs: number
}): Promise<RecordingHandle> {
  const { kind, maxDurationMs } = opts

  if (typeof MediaRecorder === 'undefined') {
    throw new Error("Recording isn't supported in this browser. Try Chrome, Brave, Arc, or Edge.")
  }

  const mimeType = kind === 'audio' ? AUDIO_MIME : VIDEO_MIME
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error("Recording isn't supported in this browser. Try Chrome, Brave, Arc, or Edge.")
  }

  let stream: MediaStream
  try {
    stream =
      kind === 'audio'
        ? await navigator.mediaDevices.getUserMedia({ audio: true })
        : await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 640, height: 480 },
          })
  } catch (e) {
    throw friendlyPermissionError(e)
  }

  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  })

  let startedAt = 0
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null
  let stopPromise: Promise<RecordingResult> | null = null
  let cancelled = false

  function releaseStream() {
    stream.getTracks().forEach((t) => t.stop())
  }

  function clearAutoStop() {
    if (autoStopTimer !== null) {
      clearTimeout(autoStopTimer)
      autoStopTimer = null
    }
  }

  const handle: RecordingHandle = {
    stream,
    mimeType,
    start() {
      if (recorder.state !== 'inactive') return
      startedAt = performance.now()
      recorder.start()
      autoStopTimer = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, maxDurationMs)
    },
    stop() {
      if (stopPromise) return stopPromise
      stopPromise = new Promise<RecordingResult>((resolve, reject) => {
        const finish = () => {
          clearAutoStop()
          releaseStream()
          if (cancelled) {
            reject(new DOMException('Recording cancelled', 'AbortError'))
            return
          }
          const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
          const blob = new Blob(chunks, { type: mimeType })
          resolve({ blob, durationMs })
        }
        if (recorder.state === 'inactive') {
          finish()
        } else {
          recorder.addEventListener('stop', finish, { once: true })
          recorder.stop()
        }
      })
      return stopPromise
    },
    cancel() {
      cancelled = true
      clearAutoStop()
      if (recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch {
          /* noop */
        }
      }
      releaseStream()
    },
  }

  return handle
}
