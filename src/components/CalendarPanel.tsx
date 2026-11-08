import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from "react"
import { clock, countdown, duration, hourLabel, people } from "../lib/format"
import { DEFAULT_WORKDAY, freeTime } from "../lib/freeTime"
import type { CalendarEvent } from "../lib/types"
import { useNow } from "../lib/useNow"
import { ArrowUpRightIcon, CalendarIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"

const MIN_EVENT_PX = 18
// px per hour before the first measurement, so server and client render the same lanes.
const GUESS_HOUR_PX = 24

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
          <FreeTime busy={live} now={now} />
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

/** "40m free until Standup · 6h 25m today". Hidden outside the workday. */
function FreeTime({ busy, now }: { busy: Array<Timed>; now: number }) {
  const free = freeTime(busy, now, DEFAULT_WORKDAY)
  if (!free) return null
  if (free.totalMs < 60_000) return <p className="free-time">Booked until {clock(free.endMs)}</p>
  return (
    <p className="free-time">
      {free.next && (
        <>
          <strong>{duration(free.next.inMs)}</strong> free until {free.next.title} ·{" "}
        </>
      )}
      <strong>{duration(free.totalMs)}</strong> free today
    </p>
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
function placeInLanes(events: Array<Timed>, hourPx: number): Array<Placed> {
  const minMs = (MIN_EVENT_PX / hourPx) * 3_600_000
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

  // Positions are percentages of the day, so all 24 hours always fill the column.
  const pct = (hour: number) => `${(hour / 24) * 100}%`
  const timelineRef = useRef<HTMLDivElement>(null)
  const hourPx = useHourPx(timelineRef)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="timeline-scroll">
      <div className="timeline" ref={timelineRef}>
        {hours.map((h) => (
          <div key={h} className="tl-hour" style={{ top: pct(h) }}>
            <span>{hourLabel(h)}</span>
          </div>
        ))}

        <div className="tl-track">
          {placeInLanes(
            events.filter((e) => hourOf(e.startMs) < 24),
            hourPx,
          ).map((e) => {
            // Clamp events that cross midnight to the visible day.
            const start = Math.max(0, hourOf(e.startMs))
            const span = Math.min(24, hourOf(e.endMs)) - start
            const isShort = span * hourPx - 3 < 30
            const isNow = current?.id === e.id
            const isPast = !isNow && e.endMs <= now
            const declined = e.status === "declined"
            const kind = eventKind(e, isNow, isPast)
            const style = {
              top: pct(start),
              height: `max(${MIN_EVENT_PX}px, calc(${pct(span)} - 3px))`,
              left: `calc(${(e.lane / e.lanes) * 100}% + ${e.lane ? 2 : 0}px)`,
              width: `calc(${100 / e.lanes}% - ${e.lane ? 2 : 0}px)`,
            }
            return (
              <div
                key={e.id}
                // Focusable for keyboard nav; Enter forwards to the Join link.
                tabIndex={-1}
                data-nav-row
                className={`tl-event ${kind}${declined ? " is-declined" : ""}${isShort ? " is-short" : ""}`}
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

          <div className="tl-now" role="img" style={{ top: pct(hourOf(now)) }} aria-label={`Now, ${clock(now)}`} />
        </div>
      </div>
    </div>
  )
}

/** Measured height of one hour row, kept current on resize. */
function useHourPx(ref: RefObject<HTMLDivElement | null>) {
  const [hourPx, setHourPx] = useState(GUESS_HOUR_PX)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHourPx(el.clientHeight / 24 || GUESS_HOUR_PX)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return hourPx
}
