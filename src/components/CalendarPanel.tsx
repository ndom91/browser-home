import { type CSSProperties, useEffect, useRef } from "react"
import { clock, countdown, hourLabel, people } from "../lib/format"
import type { CalendarEvent } from "../lib/types"
import { useNow } from "../lib/useNow"
import { ArrowUpRightIcon, CalendarIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"

const HOUR_PX = 42
const MIN_EVENT_PX = 18
const DEFAULT_START = 8
const DEFAULT_END = 18

interface Timed extends CalendarEvent {
  startMs: number
  endMs: number
}

interface Placed extends Timed {
  lane: number
  lanes: number
}

interface Props {
  events: Array<CalendarEvent> | undefined
  error: unknown
}

export function CalendarPanel({ events, error }: Props) {
  const now = useNow()

  const timed: Array<Timed> = (events ?? [])
    .filter((e) => !e.allDay)
    .map((e) => ({ ...e, startMs: Date.parse(e.start), endMs: Date.parse(e.end) }))
  const live = timed.filter((e) => e.status !== "declined")
  const current = live.find((e) => e.startMs <= now && e.endMs > now) ?? null
  const next = live.find((e) => e.startMs > now) ?? null
  const remaining = live.filter((e) => e.endMs > now).length

  let meta: string | undefined
  if (events) meta = remaining ? `${remaining} left today` : "all done"

  return (
    <Panel
      id="calendar"
      icon={<CalendarIcon />}
      title="Today"
      titleSuffix={events && <AllDay events={events.filter((e) => e.allDay)} />}
      meta={meta}
    >
      {!events ? (
        <PanelFallback error={error} />
      ) : (
        <>
          <FocusCard current={current} next={next} now={now} />
          <Timeline events={timed} current={current} now={now} />
        </>
      )}
    </Panel>
  )
}

function FocusCard({ current, next, now }: { current: Timed | null; next: Timed | null; now: number }) {
  const event = current ?? next
  if (!event) {
    return (
      <div className="focus focus-idle">
        <p className="focus-title">Nothing else on the calendar</p>
        <p className="focus-sub">The rest of the day is yours.</p>
      </div>
    )
  }

  const isLive = event === current
  const remaining = isLive ? event.endMs - now : event.startMs - now
  const label = focusLabel(event, isLive)
  const details = [
    `${clock(event.startMs)}–${clock(event.endMs)}`,
    event.provider ?? (event.location && !event.location.startsWith("http") ? event.location : null),
    event.attendees.length ? people(event.attendees) : null,
  ].filter(Boolean)

  return (
    <div className={`focus ${isLive ? "focus-live" : "focus-next"}`}>
      <div className="focus-count">
        <span className="focus-time">{countdown(remaining)}</span>
        <span className="focus-label">{label}</span>
      </div>
      <p className="focus-title">{event.title}</p>
      <p className="focus-sub">{details.join(" · ")}</p>
      {event.meeting && (
        <a className="focus-join" href={event.meeting} target="_blank" rel="noreferrer" data-nav-row>
          Join {event.provider ?? "call"} <ArrowUpRightIcon />
        </a>
      )}
    </div>
  )
}

function focusLabel(event: Timed, isLive: boolean) {
  if (!isLive) return "until start"
  return event.meeting ? "left in call" : "left"
}

function AllDay({ events }: { events: Array<CalendarEvent> }) {
  if (!events.length) return null
  return (
    <ul className="allday">
      {events.map((e) => (
        <li key={e.id} title={e.title} style={{ "--cal": e.color ?? "var(--muted)" } as CSSProperties}>
          {e.title}
        </li>
      ))}
    </ul>
  )
}

/**
 * Side-by-side lanes for overlapping events, per overlap cluster.
 * Overlap uses the drawn end: a 15 min event still takes MIN_EVENT_PX, and
 * would otherwise run under the event right after it.
 */
function placeInLanes(events: Array<Timed>): Array<Placed> {
  const minMs = (MIN_EVENT_PX / HOUR_PX) * 3_600_000
  const drawnEnd = (e: Timed) => Math.max(e.endMs, e.startMs + minMs)
  const placed: Array<Placed> = []
  let cluster: Array<Placed> = []
  let clusterEnd = -Infinity

  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((e) => e.lane + 1))
    for (const e of cluster) e.lanes = lanes
    placed.push(...cluster)
    cluster = []
  }

  for (const e of [...events].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs)) {
    if (e.startMs >= clusterEnd) flush()
    const laneEnds = new Map<number, number>()
    for (const c of cluster) laneEnds.set(c.lane, Math.max(laneEnds.get(c.lane) ?? 0, drawnEnd(c)))
    let lane = 0
    while ((laneEnds.get(lane) ?? -Infinity) > e.startMs) lane++
    cluster.push({ ...e, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, drawnEnd(e))
  }
  flush()
  return placed
}

type EventKind = "is-now" | "is-past" | "is-call" | "is-plain"

function eventKind(e: Timed, isNow: boolean, isPast: boolean): EventKind {
  if (isNow) return "is-now"
  if (isPast || e.status === "declined") return "is-past"
  if (e.meeting) return "is-call"
  return "is-plain"
}

function Timeline({ events, current, now }: { events: Array<Timed>; current: Timed | null; now: number }) {
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const hourOf = (ms: number) => (ms - dayStart.getTime()) / 3_600_000

  // Include the current hour, so the now-line stays visible early and late in the day.
  const nowHour = hourOf(now)
  const firstHour = Math.min(DEFAULT_START, Math.floor(nowHour), ...events.map((e) => Math.floor(hourOf(e.startMs))))
  // Clamp: an event running past midnight shouldn't grow a "25:00" row.
  const lastHour = Math.min(
    24,
    Math.max(DEFAULT_END, Math.ceil(nowHour), ...events.map((e) => Math.ceil(hourOf(e.endMs)))),
  )
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)
  const trackHeight = (lastHour - firstHour) * HOUR_PX
  const y = (ms: number) => (hourOf(ms) - firstHour) * HOUR_PX

  const nowY = y(now)
  const showNow = hourOf(now) >= firstHour && hourOf(now) <= lastHour

  // Bring "now" into view once on load, about a third of the way down.
  const scrollRef = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on mount only, so a ticking clock never yanks the scroll position.
  useEffect(() => {
    const el = scrollRef.current
    if (el && showNow) el.scrollTop = Math.max(0, nowY - el.clientHeight / 3)
  }, [])

  return (
    <div className="timeline-scroll" ref={scrollRef}>
      <div className="timeline" style={{ height: trackHeight + 12 }}>
        {hours.map((h) => (
          <div key={h} className="tl-hour" style={{ top: (h - firstHour) * HOUR_PX }}>
            <span>{hourLabel(h)}</span>
          </div>
        ))}

        <div className="tl-track">
          {placeInLanes(events.filter((e) => hourOf(e.startMs) < lastHour)).map((e) => {
            const top = y(e.startMs)
            const bottom = Math.min(y(e.endMs), trackHeight)
            const height = Math.max(MIN_EVENT_PX, bottom - top - 3)
            const isNow = current?.id === e.id
            const isPast = !isNow && e.endMs <= now
            const declined = e.status === "declined"
            const kind = eventKind(e, isNow, isPast)
            const style = {
              top,
              height,
              left: `calc(${(e.lane / e.lanes) * 100}% + ${e.lane ? 2 : 0}px)`,
              width: `calc(${100 / e.lanes}% - ${e.lane ? 2 : 0}px)`,
            }
            return (
              <div
                key={e.id}
                // Focusable for keyboard nav; Enter forwards to the Join link.
                tabIndex={-1}
                data-nav-row
                className={`tl-event ${kind}${declined ? " is-declined" : ""}${height < 30 ? " is-short" : ""}`}
                style={style}
                title={`${e.title}\n${clock(e.startMs)}–${clock(e.endMs)}`}
              >
                <span className="tl-label">
                  <span className="tl-title">{e.title}</span>
                  <span className="tl-at"> · {clock(e.startMs)}</span>
                </span>
                {e.meeting && !isPast && !declined && (
                  <a className="tl-join" href={e.meeting} target="_blank" rel="noreferrer" data-nav-primary>
                    Join
                  </a>
                )}
              </div>
            )
          })}

          {showNow && <div className="tl-now" role="img" style={{ top: nowY }} aria-label={`Now, ${clock(now)}`} />}
        </div>
      </div>
    </div>
  )
}
