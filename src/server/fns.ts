import { createServerFn } from "@tanstack/react-start"
import { cached } from "./cache"
import { fetchCalendar } from "./calendar"
import { DEMO, demoCalendar, demoHN, demoPRs, demoViewer } from "./demo"
import { fetchPRs, fetchViewer } from "./github"
import { fetchHN } from "./hn"

const calendar = cached(DEMO ? async () => demoCalendar() : fetchCalendar, 60_000)
const prs = cached(DEMO ? async () => demoPRs() : fetchPRs, 2 * 60_000)
const hn = cached(DEMO ? async () => demoHN() : fetchHN, 5 * 60_000)
const viewer = cached(DEMO ? async () => demoViewer : fetchViewer, 24 * 60 * 60_000)

export const getCalendar = createServerFn({ method: "GET" }).handler(() => calendar())
export const getPRs = createServerFn({ method: "GET" }).handler(() => prs())
export const getHN = createServerFn({ method: "GET" }).handler(() => hn())
export const getViewer = createServerFn({ method: "GET" }).handler(() => viewer())
