import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { parseSettings, SETTINGS_COOKIE } from "../lib/settings"
import { TTL } from "../lib/ttl"
import type { Features } from "../lib/types"
import { cached, cachedBy } from "./cache"
import { fetchCalendar } from "./calendar"
import { capture, MAX_CAPTURE } from "./capture"
import { config } from "./config"
import {
  DEMO,
  demoCalendar,
  demoDismissNotification,
  demoHN,
  demoLinear,
  demoNotifications,
  demoPRDetail,
  demoPRs,
  demoStandup,
  demoThread,
  demoViewer,
  demoWeather,
} from "./demo"
import { fetchNotifications, fetchPRDetail, fetchPRs, fetchViewer, markNotificationRead } from "./github"
import { fetchHN, fetchThread } from "./hn"
import { fetchLinear, linearConfigured } from "./linear"
import { missingLlmKeys } from "./llm"
import { fetchStandup } from "./standup"
import { fetchWeather } from "./weather"

const calendar = cached(DEMO ? async () => demoCalendar() : fetchCalendar, TTL.calendar)
const prs = cached(DEMO ? async () => demoPRs() : fetchPRs, TTL.prs)
const prDetail = cachedBy(DEMO ? async (key: string) => demoPRDetail(key) : fetchPRDetail, TTL.prDetail)
const notifications = cached(DEMO ? async () => demoNotifications() : fetchNotifications, TTL.notifications)
const linear = cached(DEMO ? async () => demoLinear() : fetchLinear, TTL.linear)
// Keyed by the standup's start, so the hour before each standup gets its own fetch.
const standup = cachedBy(
  DEMO
    ? async () => demoStandup()
    : async (start: string) => fetchStandup(start, linearConfigured() ? (await linear()).data.issues : []),
  TTL.standup,
)
const hn = cached(DEMO ? async () => demoHN() : fetchHN, TTL.hn)
const thread = cachedBy(DEMO ? async (id: number) => demoThread(id) : fetchThread, TTL.hnThread)
const weather = cached(DEMO ? async () => demoWeather : fetchWeather, TTL.weather)
const viewer = cached(DEMO ? async () => demoViewer : fetchViewer, TTL.viewer)

// Client refetches pass `true` to wait out a stale refresh. SSR passes nothing and
// takes the cached value at once.
const waitFlag = (wait: unknown) => wait === true

// Demo mode shows Linear from fixtures. Chat always needs a real model.
export const getFeatures = createServerFn({ method: "GET" }).handler(
  (): Features => ({
    chat: missingLlmKeys().length === 0,
    linear: DEMO || linearConfigured(),
    capture: Boolean(config().capture.dir),
  }),
)
/** The settings cookie, read on the server so the first paint already uses it. */
export const getSettings = createServerFn({ method: "GET" }).handler(() => parseSettings(getCookie(SETTINGS_COOKIE)))
/** The search engine URL for the header search box. The query is appended to it. */
export const getSearchUrl = createServerFn({ method: "GET" }).handler(() => config().search_url)
export const getCalendar = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => calendar({ wait: data }))
export const getPRs = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => prs({ wait: data }))
export const getNotifications = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => notifications({ wait: data }))
/** Marks a PR notification read on GitHub. Returns the list without it. */
export const dismissNotification = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !/^\d+$/.test(id)) throw new Error("Invalid notification id")
    return id
  })
  .handler(async ({ data }) => {
    if (DEMO) demoDismissNotification(data)
    else await markNotificationRead(data)
    return notifications({ force: true })
  })
export const getLinear = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => linear({ wait: data }))
/** The standup card, for the standup that starts at the given ISO time. */
export const getStandup = createServerFn({ method: "GET" })
  .validator((start: unknown) => {
    if (typeof start !== "string" || Number.isNaN(Date.parse(start))) throw new Error("Invalid standup start")
    return start
  })
  .handler(({ data }) => standup(data))
export const getHN = createServerFn({ method: "GET" })
  .validator(waitFlag)
  .handler(({ data }) => hn({ wait: data }))
// Manual refreshes. POST, so they're never served from an HTTP cache; force skips the server cache.
export const refreshHN = createServerFn({ method: "POST" }).handler(() => hn({ force: true }))
export const refreshPRs = createServerFn({ method: "POST" }).handler(() => prs({ force: true }))
export const refreshLinear = createServerFn({ method: "POST" }).handler(() => linear({ force: true }))
export const getViewer = createServerFn({ method: "GET" })
  .validator(waitFlag)
  // The greeting override applies here, not in the day-long cache, so a config edit shows at once.
  .handler(async ({ data }) => {
    const result = await viewer({ wait: data })
    const name = config().greeting_name
    return name ? { ...result, data: { ...result.data, name } } : result
  })
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

export const getPRDetail = createServerFn({ method: "GET" })
  .validator((key: unknown) => {
    if (typeof key !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[1-9]\d*$/.test(key))
      throw new Error("Invalid pull request")
    return key
  })
  .handler(({ data }) => prDetail(data))
