/** Working hours as "HH:MM", local time. */
export interface Workday {
  start: string
  end: string
}

export const DEFAULT_WORKDAY: Workday = { start: "09:00", end: "18:00" }

interface Busy {
  title: string
  startMs: number
  endMs: number
}

export interface FreeTime {
  /** The next meeting inside the workday, if you're free until it. */
  next: { title: string; inMs: number } | null
  /** Free time from now to the end of the workday. */
  totalMs: number
  endMs: number
}

/** "09:00" on the day of `now`, as epoch ms. */
function at(now: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(now).setHours(h, m, 0, 0)
}

/** Free time left in today's workday, or null outside it. `busy` excludes declined events. */
export function freeTime(busy: Array<Busy>, now: number, workday: Workday): FreeTime | null {
  const endMs = at(now, workday.end)
  if (now < at(now, workday.start) || now >= endMs) return null

  const ahead = busy.filter((e) => e.endMs > now && e.startMs < endMs).sort((a, b) => a.startMs - b.startMs)
  // Walk the sorted events once. Overlapping events merge because the cursor only moves forward.
  let cursor = now
  let totalMs = 0
  for (const e of ahead) {
    if (e.startMs > cursor) totalMs += e.startMs - cursor
    cursor = Math.max(cursor, e.endMs)
  }
  totalMs += Math.max(0, endMs - cursor)

  const first = ahead[0]
  const next = first && first.startMs > now ? { title: first.title, inMs: first.startMs - now } : null
  return { next, totalMs, endMs }
}
