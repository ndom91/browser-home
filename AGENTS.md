# AGENTS.md

Context for coding agents working in this repo. The README covers setup and use. This file covers how the code works, the gotchas already found, and how to work here.

## How to work here

- **Senior-dev style.** Think before coding: state assumptions and ask when something is ambiguous. Keep it simple: no speculative abstractions or options nobody asked for. Make surgical changes: touch only what the task needs, and match the surrounding style. Define how you'll verify the change, then verify it.
- **Comments are for the non-obvious.** Never restate the code. Comment the _why_: a constraint, a gotcha, a workaround. When in doubt, leave it out.
- **Audit before calling a large piece of work done.** Reread the diff for duplication, dead code, and simpler shapes, and for comments that restate code. Skip this for small changes.
- **Commit straight to `main`, and push.** No branches, PRs, or tickets. Commit each logical chunk as you go. Keep formatting-only changes in their own commit.
- **Never commit `.env` or `config.yaml`.** They hold secrets and personal settings. Only the `.example` files are tracked.
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
pnpm reload         # restart the launchd service, after a build or a .env change
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
    fns.ts             createServerFn wrappers, each behind cached(); getFeatures
    cache.ts           stale-while-revalidate memo (cached, cachedBy)
    calendar.ts        runs bin/agenda, parses events, detects meeting links
    github.ts          GraphQL search for your PRs, REST notifications
    linear.ts          GraphQL query for your assigned issues
    hn.ts              top stories + comment threads
    capture.ts         appends quick-capture notes to this week's Obsidian note
    weather.ts         Open-Meteo daily forecast
    config.ts          config.yaml loader: zod schema, ${VAR} from env, reload on change
    llm.ts             OpenAI-compatible adapter and MCP clients, from config
    sanitize.ts        allowlist sanitizer for HN comment HTML
    demo.ts            fixtures for dev:demo
  components/          one file per panel, plus Panel, FilteredSection, RowSignals, ChatWidget, QuickCapture,
                       Shortcuts, SettingsDialog, and columns.tsx (column names and icons)
    ui/                Base UI wrappers (FilterMenu, Dialog, Tooltip), RefreshButton, motion.tsx
  lib/                 shared by client and server: types, format, ttl, hn, settings, freeTime, and the
                       client hooks (useFacetFilter, useKeyboardNav, useTitleCount, useNow, useSettings)
calendar/agenda.swift  EventKit CLI that prints a day's events as JSON
serve.js               production Node server around dist/server/server.js
launchd/ + scripts/    run at login
```

### Data flow

1. The root route's `beforeLoad` reads the settings cookie (`getSettings()`), so theme and column layout are right on the first paint. The page loader then asks `getFeatures()` which optional parts are set up (chat, Linear). A column that is hidden, or lacks its config, never renders and never fetches. Then the loader calls every server function it needs. It waits at most `SSR_BUDGET_MS` (1.5 s) per source, then renders. A slow source loads in the browser instead.
2. On the server, each source sits behind `cached()`. Stale data is returned at once while one background refresh runs. Many tabs never multiply upstream calls.
3. On the client, `useSource()` seeds React Query with the server-rendered value. `staleTime` and `refetchInterval` come from `src/lib/ttl.ts`, the same table the server cache uses. So a new tab makes no data requests until its data expires.

**Adding a source:** write `fetchX()` in `src/server/`, wrap it in `cached()` in `fns.ts` with a `TTL` entry, add a fixture in `demo.ts`, then load it in the route loader and read it with `useSource()`. If the source needs settings, add them to the schema in `config.ts` and to `config.example.yaml`, add a flag to `Features`, and gate it like Linear. Read `config()` at call time, never into a module constant, or edits won't apply.

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

### Hacker News

- Algolia (`hn.algolia.com/api/v1/items/:id`) returns the whole comment tree in one call, but oldest first. `fetchThread()` sorts top-level comments by HN's own `kids` order. Replies stay oldest first.
- Comment HTML goes through `sanitize.ts` before it reaches `dangerouslySetInnerHTML`. Keep that boundary.

### LLM chat

- The LAN inference host uses a private-CA certificate. `llm.ts` adds the macOS keychain roots with `tls.setDefaultCACertificates`, because Node ignores the keychain by default.
- `/api/ask` accepts only `Sec-Fetch-Site: same-origin`, so other websites can't spend the model's time with the key. The key never reaches the browser.
- Vite loads only `VITE_`-prefixed variables, so both `vite.config.ts` and `serve.js` call `process.loadEnvFile()`. Variables already set (for example from launchd) win.
- `serve.js` aborts the request when the browser disconnects, so Stop also stops the upstream call.
- Answers render with `@tanstack/markdown` and its streaming extension. Raw HTML stays off.
- `mcp.servers` adds MCP tools to the chat (`mcpOptions()` in `llm.ts`). Every server connects in parallel on each request. A server that fails only logs, and the rest still serve tools. Tool names are `<server>__<tool>`; the chat strips everything up to the last `__` for display.
- HA's `/api/mcp` exposes every LLM API selected in its MCP Server integration options, write tools included.

### Linear

- Personal API keys go in the `Authorization` header as-is, without `Bearer`.
- The column needs both `linear.api_key` and `linear.workspace`. Demo mode shows it from fixtures either way.
- PRs link to issues through the issue ID in the PR title or body (`github.ts`). The Linear column reuses those IDs for its PR chip, so it makes no extra GitHub call.

### Quick capture

- Weekly notes don't always start on Monday (there's a `2026-10-13.md`). Any `YYYY-MM-DD.md` dated inside the current week counts as this week's note.
- With no note for the week, `capture.ts` copies `template.md` and fills in `week:`. It writes with `flag: "wx"`, so it never overwrites a note Obsidian created a moment earlier.

### Standup card

- Shows from 1 h before a timed event whose title matches `/stand[\s-]?up/i` until it ends (`src/lib/standup.ts`).
- "Since" is the same clock time on the previous workday, so Monday looks back to Friday.
- `cachedBy` keys it by the standup's start time. Demo mode moves "Platform standup" to 30 min from now so the card shows.
- PRs in repos that `github.search_filter` excludes don't appear. Done issues come from Linear's `completedAt`.

### Notifications and row signals

- Notifications poll every 60 s, as GitHub's `X-Poll-Interval` asks. Requests send `If-Modified-Since`. A `304` costs no rate limit, and `fetchNotifications()` replays the last list.
- `review_requested` notifications are skipped on purpose. The "Review requested" section already shows them.
- Most unread notifications belong to merged or closed PRs, which aren't listed. No icon on any row is normal.
- Stale dismissals live in localStorage, keyed by `url@updatedAt`. Demo fixtures get fresh timestamps every 2 minutes, so a dismissal there doesn't last.

### Settings and theme

- Settings are a JSON cookie (`bh-settings`), written by the browser with `document.cookie` and only read by the server. `parseSettings()` drops bad values and appends columns added later.
- Cookies are per host, not per port. Dev servers on `127.0.0.1:6477` and `:6478` share one settings cookie. Clear it after testing.
- Colors use `light-dark()`, driven by `color-scheme`. `data-theme` on `<html>` overrides it; "System" sets no attribute. Shadows can't use `light-dark()`, so `--shadow-popover` has its own dark override.

### Keyboard and motion

- `useKeyboardNav` finds its targets only through `data-nav-*`, `data-filter-trigger`, `data-refresh` and `data-refresh-default`. Never key a shortcut off a class name or an id.
- The handler checks `e.target.closest()`. To test a key from a script, dispatch the `keydown` on an element, not on `window`.
- Transitions follow transitions.dev snippets in the motion section of `styles.css`. JS timing reads the same CSS tokens through `cssMs()`, so change durations in CSS only.
- `AnimatedList` keeps leaving rows mounted (and `inert`) until their collapse finishes. Code that walks rows must skip `[inert]`, as `useKeyboardNav` does.

### Config

- `config()` stats `config.yaml` on every call and re-parses only when its mtime changes. Edits apply on the next request. Cached sources pick them up at their next refresh, except the greeting, which `getViewer` applies outside the cache.
- A file that fails to parse or validate logs the error and keeps the last good config. With no file at all, defaults apply, which hides chat and Linear.
- `${VAR}` reads `process.env`, so the `.env` rules still hold: `process.loadEnvFile()` never overrides a variable that is already set, even to an empty string. A plist entry hides the `.env` value.
- An unset `${VAR}` becomes `""` and logs a warning naming it.

### Server and tooling

- `serve.js` binds to `127.0.0.1` and rejects non-localhost `Host` headers, which blocks DNS rebinding. Keep both.
- Port 6464 is deliberate. Chromium blocks 6665–6669 (IRC) as unsafe ports.
- Editing `vite.config.ts` restarts any running dev server. A user's own `pnpm dev` can move to a new port under them.
- The launchd service runs the build that was current when it started. After `pnpm build`, restart it with `pnpm reload`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge` to 7 days and `saveExact`. A package released this week fails to install. That's on purpose: take the newest version that passes, and don't bypass the rule.

## Code style

- Biome enforces formatting: no semicolons, double quotes, 2-space indent, 120 columns. Run `pnpm format`. Never hand-format.
- CSS lives in `src/styles.css`. Colors are tokens in `:root`, written as `light-dark(light, dark)`. Add new colors as tokens, never as one-off hex values. Never add a `prefers-color-scheme` block for colors: it would ignore the theme setting.
- Icons live in `src/components/icons.tsx`: 16×16 viewBox, `currentColor`, `aria-hidden`.
- Panels use `<Panel>` from `src/components/Panel.tsx` for the header, meta text, and scroll body.
- Types shared by client and server go in `src/lib/types.ts`. Server-only code stays in `src/server/`.
