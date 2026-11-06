# AGENTS.md

Context for coding agents working in this repo. The README covers setup and use. This file covers how the code works, the gotchas already found, and how to work here.

## How to work here

- **Senior-dev style.** Think before coding: state assumptions and ask when something is ambiguous. Keep it simple: no speculative abstractions or options nobody asked for. Make surgical changes: touch only what the task needs, and match the surrounding style. Define how you'll verify the change, then verify it.
- **Comments are for the non-obvious.** Never restate the code. Comment the _why_: a constraint, a gotcha, a workaround. When in doubt, leave it out.
- **Audit before calling a large piece of work done.** Reread the diff for duplication, dead code, and simpler shapes, and for comments that restate code. Skip this for small changes.
- **Commit straight to `main`, and push.** No branches, PRs, or tickets. Commit each logical chunk as you go. Keep formatting-only changes in their own commit.
- **Never commit `.env`.** It holds the LLM API key. Only `.env.example` is tracked.
- **Other sessions may share this checkout.** Run `git status` before you commit. Stage only your own changes, and never commit another session's half-done files. If they share a file with yours, stage your hunks alone, for example with `git hash-object -w` plus `git update-index --cacheinfo`.

## Commands

```sh
pnpm dev            # live data, http://127.0.0.1:6464
pnpm dev:demo       # fixture data matching the design mockups (src/server/demo.ts)
pnpm check          # Biome lint + format check
pnpm format         # Biome format --write
pnpm typecheck      # tsc --noEmit
pnpm build          # production build into dist/
pnpm start          # node serve.js, the production server
pnpm build:agenda   # compile the Swift calendar helper into bin/agenda
```

For a second dev server, pass a port: `./node_modules/.bin/vite dev --port 6465`. Port 6464 usually belongs to the launchd service or to the user's own `pnpm dev`. Check with `lsof -iTCP:6464 -sTCP:LISTEN`. Stop only processes you started, by PID.

## Definition of done

1. `pnpm check` and `pnpm typecheck` pass.
2. UI changes: look at the page in a browser, in light **and** dark mode. Compare against `pnpm dev:demo` when the change touches a designed state.
3. Server changes: exercise the real source (GitHub, EventKit, HN, Open-Meteo, the LLM), not just the types.
4. Production-only paths (`serve.js`, `.env` loading, streaming): `pnpm build`, then run `PORT=6467 node serve.js` and hit it.
5. Large change: run the audit above.
6. Commit and push.

## Architecture

TanStack Start (React 19, Vite 8, TanStack Router + Query), served on localhost only.

```
src/
  routes/index.tsx     the page: SSR loader + client queries
  routes/api/ask.ts    POST /api/ask, LLM chat via TanStack AI (SSE)
  server/              data sources, server-only
    fns.ts             createServerFn wrappers, each behind cached()
    cache.ts           stale-while-revalidate memo (cached, cachedBy)
    calendar.ts        runs bin/agenda, parses events, detects meeting links
    github.ts          GraphQL search for your PRs
    hn.ts              top stories + comment threads
    weather.ts         Open-Meteo daily forecast
    llm.ts             OpenAI-compatible adapter from env vars
    sanitize.ts        allowlist sanitizer for HN comment HTML
    demo.ts            fixtures for dev:demo
  components/          one file per panel, plus Panel, icons, ChatWidget
  lib/                 shared by client and server: types, format, ttl, hn
calendar/agenda.swift  EventKit CLI that prints a day's events as JSON
serve.js               production Node server around dist/server/server.js
launchd/ + scripts/    run at login
```

### Data flow

1. The route loader calls every server function. It waits at most `SSR_BUDGET_MS` (1.5 s) per source, then renders. A slow source loads in the browser instead.
2. On the server, each source sits behind `cached()`. Stale data is returned at once while one background refresh runs. Many tabs never multiply upstream calls.
3. On the client, `useSource()` seeds React Query with the server-rendered value. `staleTime` and `refetchInterval` come from `src/lib/ttl.ts`, the same table the server cache uses. So a new tab makes no data requests until its data expires.

**Adding a source:** write `fetchX()` in `src/server/`, wrap it in `cached()` in `fns.ts` with a `TTL` entry, add a fixture in `demo.ts`, then load it in the route loader and read it with `useSource()`.

## Gotchas already found

### Calendar

- macOS asks the _responsible process_ for calendar permission, which is normally the app that launched you. `agenda.swift` re-spawns itself with `responsibility_spawnattrs_setdisclaim`, so the grant belongs to `bin/agenda` itself and works under a terminal, node, or launchd. Don't remove that.
- If the helper waits on a permission prompt, ask the user to click Allow. Don't work around it.
- `bin/agenda 2026-11-13` prints another day. Use it to find edge cases in real data.
- Out-of-office blocks and "Writing Day" arrive as _timed_ events of 12 h or more. `calendar.ts` treats them as all-day, or they become the live event all day.
- Google accounts often give attendees as bare emails. `displayName()` turns them into names.
- Teams links come in two formats: `/l/meetup-join/` and the newer `/meet/`.

### GitHub

- Search with diff stats and CI rollups is slow (3–8 s) and sometimes returns 502. Two parallel searches of 20, one retry on 502/504, and the cache keep it usable. Don't add heavy nested fields such as `latestReviews`. `viewerLatestReview` is the cheap way to spot a re-review.
- `GH_SEARCH_FILTER` defaults to `org:team-plain`. The plist sets it to an empty string, so the code uses `||`, not `??`.

### Hacker News

- Algolia (`hn.algolia.com/api/v1/items/:id`) returns the whole comment tree in one call, but oldest first. `fetchThread()` sorts top-level comments by HN's own `kids` order. Replies stay oldest first.
- Comment HTML goes through `sanitize.ts` before it reaches `dangerouslySetInnerHTML`. Keep that boundary.

### LLM chat

- The LAN inference host uses a private-CA certificate. `llm.ts` adds the macOS keychain roots with `tls.setDefaultCACertificates`, because Node ignores the keychain by default.
- `/api/ask` accepts only `Sec-Fetch-Site: same-origin`, so other websites can't spend the model's time with the key. The key never reaches the browser.
- Vite loads only `VITE_`-prefixed variables, so both `vite.config.ts` and `serve.js` call `process.loadEnvFile()`. Variables already set (for example from launchd) win.
- `serve.js` aborts the request when the browser disconnects, so Stop also stops the upstream call.
- Answers render with `@tanstack/markdown` and its streaming extension. Raw HTML stays off.

### Server and tooling

- `serve.js` binds to `127.0.0.1` and rejects non-localhost `Host` headers, which blocks DNS rebinding. Keep both.
- Port 6464 is deliberate. Chromium blocks 6665–6669 (IRC) as unsafe ports.
- Editing `vite.config.ts` restarts any running dev server. A user's own `pnpm dev` can move to a new port under them.
- The launchd service runs the build that was current when it started. After `pnpm build`, restart it: `launchctl kickstart -k gui/$(id -u)/com.ndom91.browser-home`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge` to 7 days and `saveExact`. A package released this week fails to install. That's on purpose: take the newest version that passes, and don't bypass the rule.

## Code style

- Biome enforces formatting: no semicolons, double quotes, 2-space indent, 120 columns. Run `pnpm format`. Never hand-format.
- CSS lives in `src/styles.css`. Colors are tokens in `:root`, with dark values in the `prefers-color-scheme: dark` block. Add new colors as token pairs, never as one-off hex values.
- Icons live in `src/components/icons.tsx`: 16×16 viewBox, `currentColor`, `aria-hidden`.
- Panels use `<Panel>` from `src/components/Panel.tsx` for the header, meta text, and scroll body.
- Types shared by client and server go in `src/lib/types.ts`. Server-only code stays in `src/server/`.
