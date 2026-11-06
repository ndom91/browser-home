import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CalendarPanel } from "../components/CalendarPanel"
import { HackerNewsPanel } from "../components/HackerNewsPanel"
import { Header } from "../components/Header"
import { PullRequestsPanel } from "../components/PullRequestsPanel"
import { getCalendar, getHN, getPRs, getViewer } from "../server/fns"
import { NowContext, useTicker } from "../lib/useNow"

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
    const [calendar, prs, hn, viewer] = await Promise.all([
      within("calendar", getCalendar()),
      within("prs", getPRs()),
      within("hn", getHN()),
      within("viewer", getViewer()),
    ])
    return { now: Date.now(), calendar, prs, hn, viewer }
  },
  staleTime: Infinity,
  component: Home,
})

function Home() {
  const initial = Route.useLoaderData()
  const now = useTicker(initial.now)

  const calendar = useQuery({
    queryKey: ["calendar"],
    queryFn: () => getCalendar(),
    initialData: initial.calendar,
    initialDataUpdatedAt: initial.calendar?.fetchedAt,
  })
  const prs = useQuery({
    queryKey: ["prs"],
    queryFn: () => getPRs(),
    initialData: initial.prs,
    initialDataUpdatedAt: initial.prs?.fetchedAt,
  })
  const hn = useQuery({
    queryKey: ["hn"],
    queryFn: () => getHN(),
    initialData: initial.hn,
    initialDataUpdatedAt: initial.hn?.fetchedAt,
  })
  const viewer = useQuery({
    queryKey: ["viewer"],
    queryFn: () => getViewer(),
    initialData: initial.viewer,
    staleTime: Infinity,
    refetchInterval: false,
  })

  return (
    <NowContext.Provider value={now}>
      <div className="page">
        <Header name={viewer.data?.data.name ?? null} />
        <main className="grid">
          <CalendarPanel events={calendar.data?.data} error={calendar.error} />
          <PullRequestsPanel prs={prs.data?.data} fetchedAt={prs.data?.fetchedAt} error={prs.error} />
          <HackerNewsPanel stories={hn.data?.data} error={hn.error} />
        </main>
      </div>
    </NowContext.Provider>
  )
}
