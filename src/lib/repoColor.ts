/**
 * Stable hue (0-359) for a repo name, so a repo keeps its color across reloads.
 * FNV-1a: tiny, fast, and spreads similar names (support-app vs support-api) apart.
 */
export function repoHue(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 360
}
