import { createServerFn } from "@tanstack/react-start"
import { TTL } from "../lib/ttl"
import { cached } from "./cache"
import { fetchCalendar } from "./calendar"
import { DEMO, demoCalendar, demoHN, demoPRs, demoViewer } from "./demo"
import { fetchPRs, fetchViewer } from "./github"
import { fetchHN } from "./hn"

const calendar = cached(DEMO ? async () => demoCalendar() : fetchCalendar, TTL.calendar)
const prs = cached(DEMO ? async () => demoPRs() : fetchPRs, TTL.prs)
const hn = cached(DEMO ? async () => demoHN() : fetchHN, TTL.hn)
const viewer = cached(DEMO ? async () => demoViewer : fetchViewer, TTL.viewer)

export const getCalendar = createServerFn({ method: "GET" }).handler(() => calendar())
export const getPRs = createServerFn({ method: "GET" }).handler(() => prs())
export const getHN = createServerFn({ method: "GET" }).handler(() => hn())
export const getViewer = createServerFn({ method: "GET" }).handler(() => viewer())
