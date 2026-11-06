# browser-home

A local start page: today's calendar, your GitHub PRs, and Hacker News. It's built with TanStack Start.

It runs entirely on your machine at `http://localhost:3000`. It needs no browser extension, no OAuth app, and no cloud service. It reuses auth you already have:

| Panel         | Source                            | Auth                       |
| ------------- | --------------------------------- | -------------------------- |
| Calendar      | macOS Calendar store via EventKit | macOS Calendars permission |
| Pull requests | GitHub GraphQL search             | `gh auth token`            |
| Hacker News   | Public Firebase API               | none                       |

The server binds to `127.0.0.1` only and rejects non-localhost `Host` headers, so other sites can't read your data.

## Setup

Requirements: macOS 14+, Node 22+, pnpm, Xcode command line tools (`swiftc`), and `gh` logged in with SSO authorized for your org.

1. Install dependencies and build the calendar helper:

   ```sh
   pnpm install
   pnpm build:agenda
   ```

2. Grant calendar access. Run this once from a terminal and click **Allow**:

   ```sh
   ./bin/agenda
   ```

   It prints today's events as JSON. If no prompt appears, check System Settings → Privacy & Security → Calendars. Your MDM may manage that permission.

3. Build and run:

   ```sh
   pnpm build
   pnpm start
   ```

4. Run it at login:

   ```sh
   ./scripts/install-launchd.sh
   ```

5. In Vivaldi, open Settings → Tabs → New Tab Page. Choose **Specific Page** and enter `http://localhost:3000`.

## Development

- `pnpm dev` starts the Vite dev server with live data.
- `pnpm dev:demo` serves fixture data that matches the design mockups. This is handy for UI work.

## Configuration

These environment variables go in `launchd/com.ndom91.browser-home.plist`. Re-run the install script after editing it.

| Variable           | Default                | Purpose                                       |
| ------------------ | ---------------------- | --------------------------------------------- |
| `PORT`             | `3000`                 | Port to listen on                             |
| `GH_SEARCH_FILTER` | `org:team-plain`       | GitHub search qualifiers for both PR searches |
| `GH_BIN`           | `/opt/homebrew/bin/gh` | Path to `gh`                                  |
| `AGENDA_BIN`       | `./bin/agenda`         | Path to the calendar helper                   |

## Notes

- **Calendar permission.** macOS asks the _responsible process_ (the app that launched you) for privacy permissions. `bin/agenda` re-spawns itself as its own responsible process, so one grant works from a terminal and under launchd. Rebuilding the binary changes its code signature, and macOS may ask again.
- **Caching.** Sources use stale-while-revalidate: calendar 1 min, PRs 2 min, HN 5 min. Every tab after the first loads instantly from cache, and the panel header shows the data's age. The server warms the caches at startup.
- **Slow sources don't block the page.** Server rendering waits at most 1.5 s per source. Anything slower loads in the browser instead.
- **Node path.** The launchd plist uses fnm's `default` alias. If you switch Node managers, edit the plist and re-run the install script.
- **Moving the repo.** The plist stores the repo path. Re-run `./scripts/install-launchd.sh` after moving it.
- **After rebuilding.** The server loads `dist/` at startup. Restart it with `launchctl kickstart -k gui/$(id -u)/com.ndom91.browser-home`.

## Uninstall

```sh
launchctl bootout gui/$(id -u)/com.ndom91.browser-home
rm ~/Library/LaunchAgents/com.ndom91.browser-home.plist
```
