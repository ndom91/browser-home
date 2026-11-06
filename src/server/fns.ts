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

export const getCalendar = createServerFn({ method: "GET" }).handler(() => calendar())
export const getPRs = createServerFn({ method: "GET" }).handler(() => prs())
export const getLinear = createServerFn({ method: "GET" }).handler(() => linear())
export const getHN = createServerFn({ method: "GET" }).handler(() => hn())
/** Manual refresh from the HN panel. POST, so it is never served from an HTTP cache. */
export const refreshHN = createServerFn({ method: "POST" }).handler(() => hn({ force: true }))
export const getViewer = createServerFn({ method: "GET" }).handler(() => viewer())
export const getWeather = createServerFn({ method: "GET" }).handler(() => weather())
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
