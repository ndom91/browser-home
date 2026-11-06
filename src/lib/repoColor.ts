/**
 * Eight oklch hues, 45° apart. A raw 0-359 hash can land two repos a few
 * degrees apart, which looks identical.
 */
const HUES = [25, 70, 120, 165, 210, 255, 300, 345]

/** FNV-1a: tiny, fast, and spreads similar names (support-app vs support-api) apart. */
function hash(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * One hue per repo. Each repo prefers the slot its name hashes to, so its color
 * holds across reloads. On a clash, a repo walks forward to the next slot whose
 * neighbors are also free, so colors on screen stay at least 90° apart. Past 4
 * repos it settles for any free slot, and past 8 hues repeat.
 */
export function repoHues(repos: Iterable<string>): Map<string, number> {
  const n = HUES.length
  const used = new Set<number>()
  const taken = (slot: number) => used.has(slot % n)
  const roomy = (slot: number) => !taken(slot) && !taken(slot + 1) && !taken(slot + n - 1)

  const out = new Map<string, number>()
  for (const repo of [...new Set(repos)].sort()) {
    const start = hash(repo) % n
    const offsets = [...Array(n).keys()]
    const offset = offsets.find((o) => roomy(start + o)) ?? offsets.find((o) => !taken(start + o)) ?? 0
    const slot = (start + offset) % n
    used.add(slot)
    out.set(repo, HUES[slot])
  }
  return out
}
