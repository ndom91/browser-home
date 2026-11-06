import { createServerFn } from "@tanstack/react-start"
import { TTL } from "../lib/ttl"
import { cached, cachedBy } from "./cache"
import { fetchCalendar } from "./calendar"
import { DEMO, demoCalendar, demoHN, demoPRs, demoThread, demoViewer, demoWeather } from "./demo"
import { fetchPRs, fetchViewer } from "./github"
import { fetchHN, fetchThread } from "./hn"
import { fetchWeather } from "./weather"

const calendar = cached(DEMO ? async () => demoCalendar() : fetchCalendar, TTL.calendar)
const prs = cached(DEMO ? async () => demoPRs() : fetchPRs, TTL.prs)
const hn = cached(DEMO ? async () => demoHN() : fetchHN, TTL.hn)
const thread = cachedBy(DEMO ? async (id: number) => demoThread(id) : fetchThread, TTL.hnThread)
const weather = cached(DEMO ? async () => demoWeather : fetchWeather, TTL.weather)
const viewer = cached(DEMO ? async () => demoViewer : fetchViewer, TTL.viewer)

export const getCalendar = createServerFn({ method: "GET" }).handler(() => calendar())
export const getPRs = createServerFn({ method: "GET" }).handler(() => prs())
export const getHN = createServerFn({ method: "GET" }).handler(() => hn())
export const getViewer = createServerFn({ method: "GET" }).handler(() => viewer())
export const getWeather = createServerFn({ method: "GET" }).handler(() => weather())
export const getHNThread = createServerFn({ method: "GET" })
  .validator((id: unknown) => {
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid story id")
    return id
  })
  .handler(({ data }) => thread(data))
