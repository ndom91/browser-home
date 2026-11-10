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
import { SettingsDialog } from "../components/SettingsDialog"
import { Shortcuts } from "../components/Shortcuts"
import type { ColumnId } from "../lib/settings"
import { upcomingStandup } from "../lib/standup"
import { TTL } from "../lib/ttl"
import { useKeyboardNav } from "../lib/useKeyboardNav"
import { NowContext, useTicker } from "../lib/useNow"
import { useSettings } from "../lib/useSettings"
import { useTitleCount } from "../lib/useTitleCount"
import type { Cached } from "../server/cache"
import {
  getCalendar,
  getFeatures,
  getHN,
  getLinear,
  getNotifications,
  getPRs,
  getStandup,
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
  loader: async ({ context }) => {
    const features = await getFeatures()
    const show = new Set(shownColumns(context.settings.columns, features.linear))
    const [calendar, prs, notifications, linear, hn, viewer, weather] = await Promise.all([
      show.has("calendar") ? within("calendar", getCalendar()) : undefined,
      // The Linear column reads PRs too, for its PR chips.
      show.has("prs") || show.has("linear") ? within("prs", getPRs()) : undefined,
      show.has("prs") ? within("notifications", getNotifications()) : undefined,
      show.has("linear") ? within("linear", getLinear()) : undefined,
      show.has("hn") ? within("hn", getHN()) : undefined,
      within("viewer", getViewer()),
      within("weather", getWeather()),
    ])
    // Only in the hour before a standup. It needs the calendar, so it runs after the rest.
    const upcoming = calendar && upcomingStandup(calendar.data, Date.now())
    const standup = upcoming ? await within("standup", getStandup({ data: upcoming.start })) : undefined
    return {
      now: Date.now(),
      features,
      calendar,
      prs,
      notifications,
      linear,
      hn,
      viewer,
      weather,
      standup,
      standupStart: upcoming?.start,
    }
  },
  staleTime: Infinity,
  component: Home,
})

/** Visible columns, in order: not hidden in settings, and set up if they need env vars. */
function shownColumns(columns: Array<{ id: ColumnId; hidden: boolean }>, linear: boolean): Array<ColumnId> {
  return columns.filter((c) => !c.hidden && (c.id !== "linear" || linear)).map((c) => c.id)
}

// Today stays narrower than the data columns, wherever it sits.
const columnWidth = (id: ColumnId) => (id === "calendar" ? "minmax(240px, 0.72fr)" : "minmax(300px, 1fr)")

function Home() {
  const initial = Route.useLoaderData()
  const { features } = initial
  const now = useTicker(initial.now)
  const { settings } = useSettings()
  const columns = shownColumns(settings.columns, features.linear)
  const show = new Set(columns)

  // A hidden column doesn't fetch. Showing it again starts its query.
  const calendar = useSource("calendar", getCalendar, initial.calendar, TTL.calendar, show.has("calendar"))
  const prs = useSource("prs", getPRs, initial.prs, TTL.prs, show.has("prs") || show.has("linear"))
  const notifications = useSource(
    "notifications",
    getNotifications,
    initial.notifications,
    TTL.notifications,
    show.has("prs"),
  )
  const linear = useSource("linear", getLinear, initial.linear, TTL.linear, show.has("linear"))
  const hn = useSource("hn", getHN, initial.hn, TTL.hn, show.has("hn"))
  // Keyed by the standup's start, so each standup gets its own data.
  const upcoming = show.has("calendar") ? upcomingStandup(calendar.data?.data ?? [], now) : undefined
  const standup = useQuery({
    queryKey: ["standup", upcoming?.start],
    queryFn: () => getStandup({ data: upcoming?.start ?? "" }),
    enabled: upcoming != null,
    initialData: upcoming && upcoming.start === initial.standupStart ? initial.standup : undefined,
    initialDataUpdatedAt: initial.standup?.fetchedAt,
    staleTime: TTL.standup,
    refetchInterval: TTL.standup,
  })
  const weather = useSource("weather", getWeather, initial.weather, TTL.weather)
  // The name barely changes, so it never refetches.
  const viewer = useSource("viewer", getViewer, initial.viewer, Infinity)
  useTitleCount(prs.data?.data, notifications.data?.data)
  const [help, setHelp] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  useKeyboardNav(
    useCallback(() => setHelp(true), []),
    openSettings,
  )

  const panel = (id: ColumnId) => {
    switch (id) {
      case "calendar":
        return (
          <CalendarPanel
            key={id}
            events={calendar.data?.data}
            standup={upcoming ? standup.data?.data : undefined}
            error={calendar.error}
          />
        )
      case "linear":
        return (
          <LinearPanel
            key={id}
            linear={linear.data?.data}
            prs={prs.data?.data}
            fetchedAt={linear.data?.fetchedAt}
            error={linear.error}
          />
        )
      case "prs":
        return (
          <PullRequestsPanel
            key={id}
            prs={prs.data?.data}
            notifications={notifications.data?.data}
            fetchedAt={prs.data?.fetchedAt}
            error={prs.error}
          />
        )
      case "hn":
        return <HackerNewsPanel key={id} stories={hn.data?.data} fetchedAt={hn.data?.fetchedAt} error={hn.error} />
    }
  }

  return (
    <NowContext.Provider value={now}>
      <div className="page">
        <Header name={viewer.data?.data.name ?? null} weather={weather.data?.data} onSettings={openSettings} />
        <main className="grid" style={{ "--grid-cols": columns.map(columnWidth).join(" ") } as CSSProperties}>
          {columns.map(panel)}
        </main>
        {features.chat && <ChatWidget />}
        {features.capture && <QuickCapture />}
        <Shortcuts open={help} onOpenChange={setHelp} features={features} columns={columns} />
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} features={features} />
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
