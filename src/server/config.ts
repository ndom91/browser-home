import { readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { parse } from "yaml"
import { z } from "zod"

/** The settings file. Secrets stay in .env and are pulled in with ${VAR}. */
export const CONFIG_PATH = resolve(process.env.BH_CONFIG ?? "config.yaml")

// YAML turns an empty `key:` into null, so treat null like a missing value.
const str = (fallback = "") =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim() || fallback)

const Schema = z.object({
  greeting_name: str(),
  search_url: str("https://www.google.com/search?q="),
  llm: z.object({ base_url: str(), model: str(), api_key: str() }).prefault({}),
  mcp: z
    .object({
      servers: z
        .array(
          z.object({
            // Also the tool-name prefix, so it must be valid in a tool name.
            name: z.string().regex(/^[A-Za-z0-9_-]+$/, "use letters, digits, - and _ only"),
            url: z.url(),
            headers: z.record(z.string(), z.string()).nullish(),
            enabled: z.boolean().default(true),
          }),
        )
        .nullish()
        .transform((v) => v ?? []),
    })
    .prefault({}),
  github: z.object({ search_filter: str() }).prefault({}),
  linear: z.object({ api_key: str(), workspace: str() }).prefault({}),
  capture: z.object({ dir: str().transform((d) => d.replace(/^~(?=\/|$)/, homedir())) }).prefault({}),
})

export type Config = z.infer<typeof Schema>

const DEFAULTS = Schema.parse({})

// Settings that moved out of .env. Still setting them does nothing, so say so once.
const MOVED_ENV = [
  "LLM_BASE_URL",
  "LLM_MODEL",
  "MCP_URL",
  "GREETING_NAME",
  "GH_SEARCH_FILTER",
  "LINEAR_WORKSPACE",
  "CAPTURE_DIR",
  "VITE_SEARCH_URL",
]

/** Replaces ${VAR} in every string with the env value, or "" when it's unset. */
function interpolate(value: unknown, missing: Set<string>): unknown {
  if (typeof value === "string")
    return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      if (process.env[name] === undefined) missing.add(name)
      return process.env[name] ?? ""
    })
  if (Array.isArray(value)) return value.map((v) => interpolate(v, missing))
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, missing)]))
  return value
}

let loaded: { mtimeMs: number; config: Config } | null = null
let warnedMoved = false

/**
 * The parsed config.yaml. Re-read whenever the file changes, so edits apply without a
 * restart. A file that fails to parse keeps the last good config, so a typo never
 * blanks the page.
 */
export function config(): Config {
  let mtimeMs: number
  try {
    mtimeMs = statSync(CONFIG_PATH).mtimeMs
  } catch {
    const moved = MOVED_ENV.filter((name) => process.env[name])
    if (moved.length && !warnedMoved) {
      warnedMoved = true
      console.warn(`${moved.join(", ")} moved to ${CONFIG_PATH}. Copy config.example.yaml there and fill it in.`)
    }
    return DEFAULTS
  }
  if (loaded?.mtimeMs === mtimeMs) return loaded.config

  let next = loaded?.config ?? DEFAULTS
  try {
    const missing = new Set<string>()
    const result = Schema.safeParse(interpolate(parse(readFileSync(CONFIG_PATH, "utf8")) ?? {}, missing))
    if (result.success) next = result.data
    else console.warn(`${CONFIG_PATH} is invalid, keeping the last good config:\n${z.prettifyError(result.error)}`)
    if (missing.size) console.warn(`${CONFIG_PATH} uses unset env vars: ${[...missing].join(", ")}`)
  } catch (err) {
    console.warn(
      `${CONFIG_PATH} can't be read, keeping the last good config:`,
      err instanceof Error ? err.message : err,
    )
  }
  loaded = { mtimeMs, config: next }
  return next
}
