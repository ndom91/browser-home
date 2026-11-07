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
 * `{ force: true }` skips the cache and waits for a fresh value.
 * `{ wait: true }` waits for the refresh when stale. Client refetches use it:
 * React Query marks whatever it receives as fresh, so a stale value would
 * stay on screen for another full TTL.
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

  return async ({ force = false, wait = false } = {}): Promise<Cached<T>> => {
    if (!value || force) return refresh()
    const current = value
    if (Date.now() - current.fetchedAt >= ttlMs) {
      const pending = refresh().catch((err: unknown) => {
        console.error("background refresh failed:", err instanceof Error ? err.message : err)
        return current
      })
      if (wait) return pending
    }
    return current
  }
}

/** `cached`, keyed by an argument. Keeps the most recently used `max` keys. */
export function cachedBy<K, T>(fn: (key: K) => Promise<T>, ttlMs: number, max = 50) {
  const entries = new Map<K, () => Promise<Cached<T>>>()
  return (key: K): Promise<Cached<T>> => {
    let entry = entries.get(key)
    if (entry) {
      entries.delete(key) // re-insert below, so Map order tracks recency
    } else {
      entry = cached(() => fn(key), ttlMs)
      if (entries.size >= max) entries.delete(entries.keys().next().value as K)
    }
    entries.set(key, entry)
    return entry()
  }
}
