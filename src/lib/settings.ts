import { DEFAULT_WORKDAY, type Workday } from "./freeTime"

export const COLUMN_IDS = ["calendar", "linear", "prs", "hn"] as const
export type ColumnId = (typeof COLUMN_IDS)[number]

export type Theme = "system" | "light" | "dark"
const THEMES: Array<Theme> = ["system", "light", "dark"]

export interface Settings {
  theme: Theme
  /** Every column, in display order. */
  columns: Array<{ id: ColumnId; hidden: boolean }>
  workday: Workday
}

export const SETTINGS_COOKIE = "bh-settings"

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  columns: COLUMN_IDS.map((id) => ({ id, hidden: false })),
  workday: DEFAULT_WORKDAY,
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Settings from the cookie. Anything missing or malformed falls back to its default,
 * and columns added since the cookie was written join at the end.
 */
export function parseSettings(raw: string | undefined): Settings {
  let v: Partial<Record<keyof Settings, unknown>> = {}
  try {
    if (raw) v = JSON.parse(raw)
  } catch {}

  const theme = THEMES.includes(v.theme as Theme) ? (v.theme as Theme) : DEFAULT_SETTINGS.theme

  const columns: Settings["columns"] = []
  for (const c of Array.isArray(v.columns) ? v.columns : []) {
    const id = c?.id as ColumnId
    if (COLUMN_IDS.includes(id) && !columns.some((x) => x.id === id)) columns.push({ id, hidden: c.hidden === true })
  }
  for (const id of COLUMN_IDS) if (!columns.some((x) => x.id === id)) columns.push({ id, hidden: false })

  return { theme, columns, workday: validWorkday(v.workday) ?? DEFAULT_WORKDAY }
}

function validWorkday(value: unknown): Workday | null {
  const { start, end } = (value ?? {}) as Partial<Workday>
  if (typeof start !== "string" || typeof end !== "string") return null
  return HHMM.test(start) && HHMM.test(end) && start < end ? { start, end } : null
}

/** A year-long cookie, written by the browser. The server only reads it. */
export function settingsCookie(settings: Settings) {
  return `${SETTINGS_COOKIE}=${encodeURIComponent(JSON.stringify(settings))}; Path=/; Max-Age=31536000; SameSite=Lax`
}
