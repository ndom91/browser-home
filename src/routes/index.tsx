import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type CSSProperties, useCallback, useState } from "react"
import { CalendarPanel } from "../components/CalendarPanel"
import { ChatWidget } from "../components/ChatWidget"
import { HackerNewsPanel } from "../components/HackerNewsPanel"
import { Header } from "../components/Header"
import { LinearPanel } from "../components/LinearPanel"
import { PullRequestsPanel } from "../components/PullRequestsPanel"
import { QuickCapture } from "../components/QuickCapture"
import { Shortcuts } from "../components/Shortcuts"
import { TTL } from "../lib/ttl"
import { useKeyboardNav } from "../lib/useKeyboardNav"
import { NowContext, useTicker } from "../lib/useNow"
import { useTitleCount } from "../lib/useTitleCount"
import type { Cached } from "../server/cache"
import {
  getCalendar,
  getFeatures,
  getHN,
  getLinear,
  getNotifications,
  getPRs,
  getViewer,
  getWeather,
} from "../server/fns"

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
    const features = await getFeatures()
    const [calendar, prs, notifications, linear, hn, viewer, weather] = await Promise.all([
      within("calendar", getCalendar()),
      within("prs", getPRs()),
      within("notifications", getNotifications()),
      features.linear ? within("linear", getLinear()) : undefined,
      within("hn", getHN()),
      within("viewer", getViewer()),
      within("weather", getWeather()),
    ])
    return { now: Date.now(), features, calendar, prs, notifications, linear, hn, viewer, weather }
  },
  staleTime: Infinity,
  component: Home,
})

function Home() {
  const initial = Route.useLoaderData()
  const { features } = initial
  const now = useTicker(initial.now)

  const calendar = useSource("calendar", getCalendar, initial.calendar, TTL.calendar)
  const prs = useSource("prs", getPRs, initial.prs, TTL.prs)
  const notifications = useSource("notifications", getNotifications, initial.notifications, TTL.notifications)
  const linear = useSource("linear", getLinear, initial.linear, TTL.linear, features.linear)
  const hn = useSource("hn", getHN, initial.hn, TTL.hn)
  const weather = useSource("weather", getWeather, initial.weather, TTL.weather)
  // The name barely changes, so it never refetches.
  const viewer = useSource("viewer", getViewer, initial.viewer, Infinity)
  useTitleCount(prs.data?.data, notifications.data?.data)
  const [help, setHelp] = useState(false)
  useKeyboardNav(useCallback(() => setHelp(true), []))

  return (
    <NowContext.Provider value={now}>
      <div className="page">
        <Header name={viewer.data?.data.name ?? null} weather={weather.data?.data} />
        <main className="grid" style={{ "--columns": features.linear ? 3 : 2 } as CSSProperties}>
          <CalendarPanel events={calendar.data?.data} error={calendar.error} />
          {features.linear && (
            <LinearPanel
              linear={linear.data?.data}
              prs={prs.data?.data}
              fetchedAt={linear.data?.fetchedAt}
              error={linear.error}
            />
          )}
          <PullRequestsPanel
            prs={prs.data?.data}
            notifications={notifications.data?.data}
            fetchedAt={prs.data?.fetchedAt}
            error={prs.error}
          />
          <HackerNewsPanel stories={hn.data?.data} fetchedAt={hn.data?.fetchedAt} error={hn.error} />
        </main>
        {features.chat && <ChatWidget />}
        <QuickCapture />
        <Shortcuts open={help} onOpenChange={setHelp} features={features} />
      </div>
    </NowContext.Provider>
  )
}

/** Starts from the server-rendered value and treats it as fresh until its TTL runs out. */
function useSource<T>(
  key: string,
  fetch: (opts: { data: boolean }) => Promise<Cached<T>>,
  initial: Cached<T> | undefined,
  ttl: number,
  enabled = true,
) {
  return useQuery({
    queryKey: [key],
    enabled,
    queryFn: () => fetch({ data: true }),
    initialData: initial,
    initialDataUpdatedAt: initial?.fetchedAt,
    staleTime: ttl,
    refetchInterval: ttl === Infinity ? false : ttl,
  })
}
