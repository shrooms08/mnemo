import type { Plaintext } from '../pages/NewMessage/state'

function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s} s`
  return `${m} min ${String(s).padStart(2, '0')} s`
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `~${Math.max(1, Math.round(kb))} KB`
  const mb = kb / 1024
  return `~${(Math.round(mb * 10) / 10).toFixed(1)} MB`
}

// Brief label for the right-rail "MESSAGE CAPTURED" indicator on Step 2.
export function capturedLabel(p: Plaintext): string {
  if (p.kind === 'text') {
    const text = p.text
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const bytes = new TextEncoder().encode(text).length + 30
    return `Letter · ${words} words · ${fmtSize(bytes)}`
  }
  if (p.kind === 'audio') {
    return `Audio · ${fmtDuration(p.durationMs)} · ${fmtSize(p.blob.size)}`
  }
  return `Video · ${fmtDuration(p.durationMs)} · ${fmtSize(p.blob.size)}`
}

// Long label for the Step 3 summary "Contents" row.
export function contentsLabel(p: Plaintext): string {
  if (p.kind === 'text') {
    const text = p.text
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const bytes = new TextEncoder().encode(text).length + 30
    return `Letter · ${words} words · ${fmtSize(bytes)} · encrypted`
  }
  if (p.kind === 'audio') {
    return `Audio · ${fmtDuration(p.durationMs)} · ${fmtSize(p.blob.size)} · encrypted`
  }
  return `Video · ${fmtDuration(p.durationMs)} · ${fmtSize(p.blob.size)} · encrypted`
}
