const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })

/** "10:42" */
export function clock(ms: number) {
  return clockFmt.format(ms)
}

/** "8:00" style hour label for the timeline gutter. */
export function hourLabel(hour: number) {
  return `${hour}:00`
}

/** "Friday, November 6" */
export function longDay(ms: number) {
  return dayFmt.format(ms)
}

/** Compact age: "now", "4m", "3h", "2d". */
export function age(ms: number, now: number) {
  const diff = Math.max(0, now - ms)
  if (diff < MIN) return "now"
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  return `${Math.floor(diff / DAY)}d`
}

/** "synced just now" / "synced 3m ago" */
export function synced(ms: number | undefined, now: number) {
  if (!ms) return "syncing…"
  const a = age(ms, now)
  return a === "now" ? "synced just now" : `synced ${a} ago`
}

/** A rough length of time: "45m", "2h", "1h 40m". Rounds down to the minute. */
export function duration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Countdown: "17:24" under an hour, "1:05:09" above. */
export function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function greeting(ms: number) {
  const h = new Date(ms).getHours()
  if (h < 5) return "Good night"
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function firstName(name: string) {
  return name.trim().split(/[\s@]/)[0]
}

/** "Priya, Sam, Mara" or "Priya, Sam, Mara +4" */
export function people(names: Array<string>, max = 3) {
  const first = names.slice(0, max).map(firstName)
  const rest = names.length - first.length
  return rest > 0 ? `${first.join(", ")} +${rest}` : first.join(", ")
}

type Size = "XS" | "S" | "M" | "L" | "XL"

export function prSize(additions: number, deletions: number): Size {
  const lines = additions + deletions
  if (lines < 20) return "XS"
  if (lines < 100) return "S"
  if (lines < 500) return "M"
  if (lines < 1000) return "L"
  return "XL"
}

export function signed(n: number, sign: "+" | "−") {
  return `${sign}${n.toLocaleString("en-US")}`
}

/** "1 comment", "2 comments" */
export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}
