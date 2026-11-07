import { createServerFn } from "@tanstack/react-start"
import { TTL } from "../lib/ttl"
import { cached, cachedBy } from "./cache"
import { fetchCalendar } from "./calendar"
import { capture, MAX_CAPTURE } from "./capture"
import { DEMO, demoCalendar, demoHN, demoLinear, demoPRs, demoThread, demoViewer, demoWeather } from "./demo"
import { fetchPRs, fetchViewer } from "./github"
import { fetchHN, fetchThread } from "./hn"
import { fetchLinear } from "./linear"
import { fetchWeather } from "./weather"

const calendar = cached(DEMO ? async () => demoCalendar() : fetchCalendar, TTL.calendar)
const prs = cached(DEMO ? async () => demoPRs() : fetchPRs, TTL.prs)
const linear = cached(DEMO ? async () => demoLinear() : fetchLinear, TTL.linear)
const hn = cached(DEMO ? async () => demoHN() : fetchHN, TTL.hn)
const thread = cachedBy(DEMO ? async (id: number) => demoThread(id) : fetchThread, TTL.hnThread)
const weather = cached(DEMO ? async () => demoWeather : fetchWeather, TTL.weather)
const viewer = cached(DEMO ? async () => demoViewer : fetchViewer, TTL.viewer)

// Client refetches pass `true` to wait out a stale refresh. SSR passes nothing and
// takes the cached value at once.
const waitFlag = (wait: unknown) => wait === true

export const getCalendar = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => calendar({ wait: data }))
export const getPRs = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => prs({ wait: data }))
export const getLinear = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => linear({ wait: data }))
export const getHN = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => hn({ wait: data }))
// Manual refreshes. POST, so they're never served from an HTTP cache; force skips the server cache.
export const refreshHN = createServerFn({ method: "POST" }).handler(() => hn({ force: true }))
export const refreshPRs = createServerFn({ method: "POST" }).handler(() => prs({ force: true }))
export const refreshLinear = createServerFn({ method: "POST" }).handler(() => linear({ force: true }))
export const getViewer = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => viewer({ wait: data }))
export const getWeather = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => weather({ wait: data }))
export const getHNThread = createServerFn({ method: "GET" })
  .validator((id: unknown) => {
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid story id")
    return id
  })
  .handler(({ data }) => thread(data))

/** Quick capture: appends a bullet to this week's Obsidian note. */
export const captureNote = createServerFn({ method: "POST" })
  .validator((text: unknown) => {
    if (typeof text !== "string" || !text.trim()) throw new Error("Nothing to save")
    if (text.length > MAX_CAPTURE) throw new Error(`Keep it under ${MAX_CAPTURE} characters`)
    return text
  })
  .handler(async ({ data }) => ({ note: await capture(data) }))
