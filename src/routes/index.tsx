import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CalendarPanel } from "../components/CalendarPanel"
import { ChatWidget } from "../components/ChatWidget"
import { HackerNewsPanel } from "../components/HackerNewsPanel"
import { Header } from "../components/Header"
import { PullRequestsPanel } from "../components/PullRequestsPanel"
import { TTL } from "../lib/ttl"
import { NowContext, useTicker } from "../lib/useNow"
import type { Cached } from "../server/cache"
import { getCalendar, getHN, getPRs, getViewer, getWeather } from "../server/fns"

// SSR waits this long per source. Anything slower (a cold GitHub call, a
// pending calendar permission prompt) loads on the client instead.
const SSR_BUDGET_MS = 1500

function within<T>(name: string, promise: Promise<T>): Promise<T | undefined> {
  return Promise.race([
    promise.catch((err: unknown) => {
      // The client query retries and shows the error in the panel.
      console.error(`[ssr] ${name}:`, err instanceof Error ? err.message : err)
      return undefined
    }),
    new Promise<undefined>((resolve) => setTimeout(resolve, SSR_BUDGET_MS)),
  ])
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const [calendar, prs, hn, viewer, weather] = await Promise.all([
      within("calendar", getCalendar()),
      within("prs", getPRs()),
      within("hn", getHN()),
      within("viewer", getViewer()),
      within("weather", getWeather()),
    ])
    return { now: Date.now(), calendar, prs, hn, viewer, weather }
  },
  staleTime: Infinity,
  component: Home,
})

function Home() {
  const initial = Route.useLoaderData()
  const now = useTicker(initial.now)

  const calendar = useSource("calendar", getCalendar, initial.calendar, TTL.calendar)
  const prs = useSource("prs", getPRs, initial.prs, TTL.prs)
  const hn = useSource("hn", getHN, initial.hn, TTL.hn)
  const weather = useSource("weather", getWeather, initial.weather, TTL.weather)
  // The name barely changes, so it never refetches.
  const viewer = useSource("viewer", getViewer, initial.viewer, Infinity)

  return (
    <NowContext.Provider value={now}>
      <div className="page">
        <Header name={viewer.data?.data.name ?? null} weather={weather.data?.data} />
        <main className="grid">
          <CalendarPanel events={calendar.data?.data} error={calendar.error} />
          <PullRequestsPanel prs={prs.data?.data} fetchedAt={prs.data?.fetchedAt} error={prs.error} />
          <HackerNewsPanel stories={hn.data?.data} error={hn.error} />
        </main>
        <ChatWidget />
      </div>
    </NowContext.Provider>
  )
}

/** Starts from the server-rendered value and treats it as fresh until its TTL runs out. */
function useSource<T>(key: string, fetch: () => Promise<Cached<T>>, initial: Cached<T> | undefined, ttl: number) {
  return useQuery({
    queryKey: [key],
    queryFn: () => fetch(),
    initialData: initial,
    initialDataUpdatedAt: initial?.fetchedAt,
    staleTime: ttl,
    refetchInterval: ttl === Infinity ? false : ttl,
  })
}
