import { appendFile, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const DIR = process.env.CAPTURE_DIR?.trim() || "/Users/ndom91/obsidian/Plain/Weekly Notes"
const TEMPLATE = "template.md"
export const MAX_CAPTURE = 2000

/** "2026-11-02" in local time. */
function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday and Sunday of the week containing `now`, as YYYY-MM-DD. */
function weekRange(now: Date) {
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: isoDate(monday), sunday: isoDate(sunday) }
}

/**
 * This week's note. Notes don't always start on Monday (there's a 2026-10-13), so any
 * dated note inside the week counts. With none, create one from the template.
 */
async function weeklyNote(now: Date): Promise<string> {
  const { monday, sunday } = weekRange(now)
  const existing = (await readdir(DIR))
    .map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
    .filter((d): d is string => d != null && d >= monday && d <= sunday)
    .sort()
  if (existing.length) return `${existing[0]}.md`

  const name = `${monday}.md`
  const template = await readFile(join(DIR, TEMPLATE), "utf8")
  // flag "wx": never overwrite, in case Obsidian created it a moment ago.
  await writeFile(join(DIR, name), template.replace(/^week:.*$/m, `week: ${monday}`), { flag: "wx" }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code !== "EEXIST") throw err
    },
  )
  return name
}

/** Appends a bullet to the end of this week's note. Returns the note's file name. */
export async function capture(text: string, now = new Date()): Promise<string> {
  const [first, ...rest] = text.trim().split(/\r?\n/)
  const bullet = [`- ${first}`, ...rest.map((line) => `  ${line}`)].join("\n")
  const name = await weeklyNote(now)
  const path = join(DIR, name)
  const current = await readFile(path, "utf8")
  await appendFile(path, `${current.endsWith("\n") || current === "" ? "" : "\n"}${bullet}\n`)
  return name
}
