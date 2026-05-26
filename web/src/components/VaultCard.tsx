import { Link } from 'react-router-dom'
import type { VaultRecord } from '../lib/vaults'
import { truncateAddress, relativeTime, formatLongDate } from '../lib/format'

type ViewAs = 'creator' | 'recipient'
type Tone = 'brass' | 'sage' | 'stone'

type PillText = {
  label: string
  detailPrefix: string
  criticalTime?: string
  detailNormal?: string
}

function tone(v: VaultRecord): Tone {
  if (v.status === 'CANCELLED') return 'stone'
  if (v.status === 'UNLOCKED') return 'sage'
  if (v.isUnlockable) return 'sage'
  return 'brass'
}

function firstChar(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return '·'
  const c = [...trimmed][0]
  return /[a-zA-Z]/.test(c) ? c.toUpperCase() : c
}

function urgencyRatio(v: VaultRecord, now: bigint): number | null {
  if (!v.requiresCheckin || v.checkinIntervalMs <= 0n) return null
  const elapsed = now - v.lastCheckinMs
  const remaining = v.checkinIntervalMs - elapsed
  if (remaining <= 0n) return 0
  // Float math is acceptable here — we only need bucket-level precision.
  return Number(remaining) / Number(v.checkinIntervalMs)
}

function pillText(v: VaultRecord, now: bigint): PillText {
  if (v.status === 'CANCELLED') return { label: 'Cancelled', detailPrefix: '' }
  if (v.status === 'UNLOCKED') return { label: 'Delivered', detailPrefix: 'Opened' }
  if (v.isUnlockable) return { label: 'Open', detailPrefix: 'Ready to be read' }
  if (v.requiresCheckin) {
    const since = now - v.lastCheckinMs
    const time = `${relativeTime(since)} ago`
    const ratio = urgencyRatio(v, now)
    const critical = ratio !== null && ratio < 0.1
    return {
      label: 'Waiting',
      detailPrefix: 'Last check-in ',
      ...(critical ? { criticalTime: time } : { detailNormal: time }),
    }
  }
  const delta = v.unlockTimeMs - now
  return { label: 'Sealed', detailPrefix: `Opens in ${relativeTime(delta)}` }
}

function metaLine(v: VaultRecord, now: bigint): { warning?: string; text: string } {
  if (v.status === 'CANCELLED') return { text: 'Cancelled. Held in the vault.' }
  if (v.status === 'UNLOCKED') {
    return { text: 'Its time arrived. The recipient can read it.' }
  }
  const hasTime = v.unlockTimeMs > 0n
  const ratio = urgencyRatio(v, now)
  const warning = ratio !== null && ratio < 0.1 ? 'Check in soon.' : undefined

  if (v.requiresCheckin) {
    const remaining = v.checkinIntervalMs - (now - v.lastCheckinMs)
    if (remaining > 0n) {
      const rem = relativeTime(remaining)
      if (hasTime) {
        return {
          warning,
          text: `Opens ${formatLongDate(v.unlockTimeMs)}, or releases in ${rem} if I go silent.`,
        }
      }
      return { warning, text: `Releases in ${rem} if I go silent.` }
    }
  }
  if (hasTime) return { text: `Opens ${formatLongDate(v.unlockTimeMs)}.` }
  if (v.requiresCheckin) {
    return { text: `Releases if I am gone for ${relativeTime(v.checkinIntervalMs)}.` }
  }
  return { text: '' }
}

function smallLine(v: VaultRecord): string {
  if (v.status === 'UNLOCKED') return 'Opened'
  if (v.status === 'CANCELLED') return 'Cancelled'
  if (v.isUnlockable) return 'Ready to open'
  if (v.unlockTimeMs > 0n) return `Opens ${formatLongDate(v.unlockTimeMs)}`
  return `Sealed ${formatLongDate(v.createdAtMs)}`
}

export function VaultCard({
  vault,
  viewAs,
  linkTo,
  enableCheckin,
  isCheckingIn,
  isRecentlyCheckedIn,
  checkinError,
  onCheckIn,
}: {
  vault: VaultRecord
  viewAs?: ViewAs
  linkTo?: string
  enableCheckin?: boolean
  isCheckingIn?: boolean
  isRecentlyCheckedIn?: boolean
  checkinError?: string
  onCheckIn?: () => void
}) {
  const t = tone(vault)
  const now = BigInt(Date.now())
  const pill = pillText(vault, now)
  const meta = metaLine(vault, now)
  const perspective: ViewAs = viewAs ?? vault.roles[0] ?? 'creator'
  const counterparty = perspective === 'recipient' ? vault.creator : vault.recipient
  const counterpartyLabel = perspective === 'recipient' ? 'From' : 'To'

  const showCheckin =
    enableCheckin &&
    vault.status === 'SEALED' &&
    vault.requiresCheckin &&
    !vault.isUnlockable &&
    vault.roles.includes('creator')

  const articleClass = `vault-card${isRecentlyCheckedIn ? ' recent-checkin' : ''}`

  const card = (
    <article className={articleClass}>
      <div className={`vault-seal ${t}`} aria-hidden="true">
        {firstChar(vault.title)}
      </div>
      <div className="vault-body">
        <h3 className="vault-title h2">{vault.title}</h3>
        <p className="vault-recipient">
          <span className="name">
            {counterpartyLabel} <span className="addr">{truncateAddress(counterparty)}</span>
          </span>
        </p>
        <p className="vault-meta">
          {meta.warning && <span className="meta-warning">{meta.warning}</span>}
          {meta.text}
        </p>
      </div>
      <div className="vault-side">
        <span className={`status ${t}`}>
          <span className="dot" />
          {pill.label}
          {(pill.detailPrefix || pill.criticalTime || pill.detailNormal) && (
            <>
              <span className="divider" />
              {pill.detailPrefix}
              {pill.criticalTime && <span className="critical-time">{pill.criticalTime}</span>}
              {pill.detailNormal}
            </>
          )}
        </span>
        <p className="small">{smallLine(vault)}</p>
        {showCheckin && (
          <CheckinSlot
            isCheckingIn={!!isCheckingIn}
            isRecentlyCheckedIn={!!isRecentlyCheckedIn}
            error={checkinError}
            onCheckIn={onCheckIn}
          />
        )}
      </div>
    </article>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="vault-card-link">
        {card}
      </Link>
    )
  }
  return card
}

function CheckinSlot({
  isCheckingIn,
  isRecentlyCheckedIn,
  error,
  onCheckIn,
}: {
  isCheckingIn: boolean
  isRecentlyCheckedIn: boolean
  error?: string
  onCheckIn?: () => void
}) {
  if (isCheckingIn) {
    return (
      <button type="button" className="checkin-link pending" disabled>
        Checking in…
      </button>
    )
  }
  if (isRecentlyCheckedIn) {
    return (
      <span className="checkin-link success" aria-live="polite">
        Checked in just now ✓
      </span>
    )
  }
  if (error) {
    return (
      <button
        type="button"
        className="checkin-link error"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onCheckIn?.()
        }}
      >
        Couldn't check in. Try again.
      </button>
    )
  }
  return (
    <button
      type="button"
      className="checkin-link"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onCheckIn?.()
      }}
    >
      Check in →
    </button>
  )
}
