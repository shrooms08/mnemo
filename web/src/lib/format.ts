export function truncateAddress(addr: string | undefined | null, head = 6, tail = 4): string {
  if (!addr) return '—'
  if (addr.length <= head + tail + 1) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

export function relativeTime(deltaMs: bigint): string {
  const abs = deltaMs < 0n ? -deltaMs : deltaMs
  const ms = Number(abs)
  let value: number
  let unit: string
  if (ms >= YEAR) { value = Math.floor(ms / YEAR); unit = 'year' }
  else if (ms >= MONTH) { value = Math.floor(ms / MONTH); unit = 'month' }
  else if (ms >= DAY) { value = Math.floor(ms / DAY); unit = 'day' }
  else if (ms >= HOUR) { value = Math.floor(ms / HOUR); unit = 'hour' }
  else if (ms >= MIN) { value = Math.floor(ms / MIN); unit = 'minute' }
  else { value = Math.max(1, Math.floor(ms / SEC)); unit = 'second' }
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatLongDate(ms: bigint): string {
  return longDate.format(new Date(Number(ms)))
}
