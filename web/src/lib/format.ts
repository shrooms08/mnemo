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

/** Cheap heuristic: does this address look like a placeholder, all-zeros,
 *  or contain a long repeated run? Used for non-blocking "double-check" warnings. */
export function looksUnusualAddress(addr: string): boolean {
  const body = addr.replace(/^0x/i, '').toLowerCase()
  if (body.length === 0) return false
  if (/^0+$/.test(body)) return true
  return /(.)\1{3}/.test(body)
}

export function relativeTimeLong(deltaMs: bigint): string {
  const abs = deltaMs < 0n ? -deltaMs : deltaMs
  const ms = Number(abs)
  const years = Math.floor(ms / YEAR)
  const monthsRem = Math.floor((ms - years * YEAR) / MONTH)
  if (years > 0) {
    if (monthsRem > 0) {
      return `${years} year${years === 1 ? '' : 's'}, ${monthsRem} month${monthsRem === 1 ? '' : 's'}`
    }
    return `${years} year${years === 1 ? '' : 's'}`
  }
  const months = Math.floor(ms / MONTH)
  const daysRem = Math.floor((ms - months * MONTH) / DAY)
  if (months > 0) {
    if (daysRem > 0) {
      return `${months} month${months === 1 ? '' : 's'}, ${daysRem} day${daysRem === 1 ? '' : 's'}`
    }
    return `${months} month${months === 1 ? '' : 's'}`
  }
  return relativeTime(deltaMs)
}
