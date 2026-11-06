export interface Cached<T> {
  data: T
  fetchedAt: number
}

/**
 * Stale-while-revalidate memo for a slow source.
 *
 * - Fresh (< ttlMs): served from memory.
 * - Stale: served from memory at once while one background refresh runs.
 *   `fetchedAt` stays honest, so the UI can show "synced 3m ago".
 * - Empty: callers share one in-flight request.
 *
 * A failed background refresh keeps the last good value.
 */
export function cached<T>(fn: () => Promise<T>, ttlMs: number) {
  let value: Cached<T> | null = null
  let inflight: Promise<Cached<T>> | null = null

  const refresh = () =>
    (inflight ??= fn()
      .then((data) => (value = { data, fetchedAt: Date.now() }))
      .finally(() => {
        inflight = null
      }))

  return async (): Promise<Cached<T>> => {
    if (!value) return refresh()
    if (Date.now() - value.fetchedAt >= ttlMs) {
      refresh().catch((err: unknown) => {
        console.error("background refresh failed:", err instanceof Error ? err.message : err)
      })
    }
    return value
  }
}
