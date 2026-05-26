import type { VaultRecord } from '../lib/vaults'
import { truncateAddress, relativeTime, formatLongDate } from '../lib/format'

type Tone = 'brass' | 'sage' | 'stone'

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

function pillText(v: VaultRecord, now: bigint): { label: string; detail: string } {
  if (v.status === 'CANCELLED') return { label: 'Cancelled', detail: '' }
  if (v.status === 'UNLOCKED') return { label: 'Delivered', detail: 'Opened' }
  if (v.isUnlockable) return { label: 'Open', detail: 'Ready to be read' }
  if (v.requiresCheckin) {
    const since = now - v.lastCheckinMs
    return { label: 'Waiting', detail: `Last check-in ${relativeTime(since)} ago` }
  }
  const delta = v.unlockTimeMs - now
  return { label: 'Sealed', detail: `Opens in ${relativeTime(delta)}` }
}

function metaLine(v: VaultRecord, now: bigint): string {
  if (v.status === 'CANCELLED') return 'Cancelled. Held in the vault.'
  if (v.status === 'UNLOCKED') return 'Its time arrived. The recipient can read it.'
  const hasTime = v.unlockTimeMs > 0n
  if (hasTime && v.requiresCheckin) {
    return `Opens ${formatLongDate(v.unlockTimeMs)}, or earlier if I go silent for ${relativeTime(v.checkinIntervalMs)}.`
  }
  if (hasTime) return `Opens ${formatLongDate(v.unlockTimeMs)}.`
  if (v.requiresCheckin) {
    return `Releases if I am gone for ${relativeTime(v.checkinIntervalMs)}.`
  }
  void now
  return ''
}

function smallLine(v: VaultRecord): string {
  if (v.status === 'UNLOCKED') return 'Opened'
  if (v.status === 'CANCELLED') return 'Cancelled'
  if (v.isUnlockable) return 'Ready to open'
  if (v.unlockTimeMs > 0n) return `Opens ${formatLongDate(v.unlockTimeMs)}`
  return `Sealed ${formatLongDate(v.createdAtMs)}`
}

export function VaultCard({ vault }: { vault: VaultRecord }) {
  const t = tone(vault)
  const now = BigInt(Date.now())
  const { label, detail } = pillText(vault, now)
  const counterparty = vault.role === 'recipient' ? vault.creator : vault.recipient
  const counterpartyLabel = vault.role === 'recipient' ? 'From' : 'To'

  return (
    <article className="vault-card">
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
        <p className="vault-meta">{metaLine(vault, now)}</p>
      </div>
      <div className="vault-side">
        <span className={`status ${t}`}>
          <span className="dot" />
          {label}
          {detail && (
            <>
              <span className="divider" />
              {detail}
            </>
          )}
        </span>
        <p className="small">{smallLine(vault)}</p>
      </div>
    </article>
  )
}
