import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { promisify } from "node:util"
import type { CalendarEvent } from "../lib/types"

const run = promisify(execFile)

// Resolved from the working directory: the bundled server lives in a
// different folder than this source file, so import.meta.url won't do.
const AGENDA_BIN = process.env.AGENDA_BIN ?? resolve(process.cwd(), "bin/agenda")

const PROVIDERS: Array<[RegExp, string]> = [
  [/https:\/\/meet\.google\.com\/[a-z0-9-]+/i, "Meet"],
  [/https:\/\/[\w.-]*zoom\.us\/[^\s<>")]+/i, "Zoom"],
  [/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>")]+/i, "Teams"],
  [/https:\/\/app\.around\.co\/[^\s<>")]+/i, "Around"],
]

interface RawEvent extends Omit<CalendarEvent, "meeting" | "provider"> {
  notes: string | null
  url: string | null
}

// Conferencing links usually live in the URL, location, or notes fields.
function findMeeting(event: RawEvent) {
  for (const field of [event.url, event.location, event.notes]) {
    if (!field) continue
    for (const [re, provider] of PROVIDERS) {
      const match = field.match(re)
      if (match) return { meeting: match[0], provider }
    }
  }
  return { meeting: null, provider: null }
}

export async function fetchCalendar(): Promise<Array<CalendarEvent>> {
  let stdout: string
  try {
    ;({ stdout } = await run(AGENDA_BIN, [], { timeout: 10_000 }))
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean; stderr?: string }
    if (err.code === "ENOENT") throw new Error("bin/agenda is missing. Run `npm run build:agenda`.")
    // A hang almost always means macOS is showing a permission prompt.
    if (err.killed) throw new Error("Calendar timed out. Run `./bin/agenda` in a terminal and allow access.")
    throw new Error(err.stderr?.trim() || err.message)
  }

  return (JSON.parse(stdout) as Array<RawEvent>).map(({ notes, url, ...event }) => ({
    ...event,
    location: event.location ?? null,
    ...findMeeting({ ...event, notes, url }),
  }))
}
