import type { CalendarEvent } from "./types"

const STANDUP = /\bstand[\s-]?up\b/i
// The card shows from this long before the standup until it ends.
const LEAD_MS = 60 * 60_000

/** Today's standup, if it starts within the hour or is running now. */
export function upcomingStandup(events: Array<CalendarEvent>, now: number) {
  return events.find(
    (e) =>
      !e.allDay &&
      e.status !== "declined" &&
      STANDUP.test(e.title) &&
      Date.parse(e.start) - LEAD_MS <= now &&
      now < Date.parse(e.end),
  )
}

/** The same clock time on the previous workday: yesterday, or Friday when it's Monday. */
export function previousWorkday(ms: number) {
  const d = new Date(ms)
  do d.setDate(d.getDate() - 1)
  while (d.getDay() === 0 || d.getDay() === 6)
  return d.getTime()
}
