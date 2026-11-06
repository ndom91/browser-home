import { createContext, useContext, useEffect, useState } from "react"

export const NowContext = createContext<number>(0)

export function useNow() {
  return useContext(NowContext)
}

/**
 * Ticks once a second, aligned to the wall clock. Starts from the server's
 * timestamp so the first client render matches the SSR markup exactly.
 */
export function useTicker(initial: number) {
  const [now, setNow] = useState(initial)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const t = Date.now()
      setNow(t)
      timer = setTimeout(tick, 1000 - (t % 1000))
    }
    tick()
    return () => clearTimeout(timer)
  }, [])
  return now
}
