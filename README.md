# browser-home

![](./.github/assets/screenshot_002.png)

A new-tab page that runs on your own Mac. One glance shows:

- **Today**: your calendar as a timeline, with a countdown to the next meeting and a Join button.
- **My issues** (optional): your Linear issues in progress, todo and backlog, with a chip when one of your PRs names the issue.
- **Pull requests**: PRs waiting for your review, and your own, with CI status and size.
- **Hacker News**: the top stories, with a built-in threaded comment viewer.
- **Weather**: today's forecast for Berlin.
- **Quick question** (optional): a chat box at the bottom that asks your local LLM.
- **Quick capture**: press `c` to add a bullet to this week's Obsidian note.

The tab title shows a count, like `(3) Home`, when PRs wait for your review or your own PRs fail CI.

It runs at `http://localhost:6464`. It needs no browser extension, no OAuth app, and no cloud service. It reuses logins you already have: the macOS Calendar app and the `gh` CLI. Only your own machine can reach it.

## Setup

You need macOS 14+, Node 24+, pnpm, the Xcode command line tools, and `gh` logged in.

1. Install, and build the small calendar helper:

   ```sh
   pnpm install
   pnpm build:agenda
   ```

2. Allow calendar access. Run this once and click **Allow** when macOS asks:

   ```sh
   ./bin/agenda
   ```

   It prints today's events. No prompt? Check System Settings → Privacy & Security → Calendars.

3. Optional: copy `.env.example` to `.env` and fill in what you want. The chat box needs your LLM's URL, model and API key. The Linear column needs an API key and your workspace slug. Each one stays hidden until its settings are there.

4. Build it, and start it at every login:

   ```sh
   pnpm build
   ./scripts/install-launchd.sh
   ```

5. Set it as your new-tab page. In Vivaldi: Settings → Tabs → New Tab Page → **Specific Page** → `http://localhost:6464`.

## Using it

Press `?` for the full list. The main ones:

| Key                | Does                                                  |
| ------------------ | ----------------------------------------------------- |
| `⌘K`               | Search the web, or type a URL                         |
| `1`–`4`, `h` / `l` | Jump to a column                                      |
| `j` / `k`, `↵`     | Move through rows, open one                           |
| `f` / `r`          | Filter the section / refresh the column               |
| `c`                | Quick capture to this week's note                     |
| `/`                | Ask the local LLM                                     |
| `Esc`              | Leave the column, hide the chat, or leave HN comments |

- Click **N comments** on a story to read the thread right in the HN column. Click `[–]` or a thread line to fold a branch.
- Links and searches open in a new tab, so this page stays put.
- The filter icon on each PR and Linear section filters by repo, project, author, status and more. Active filters show as pills next to it, and filters are remembered.

## Settings

Edit `launchd/com.ndom91.browser-home.plist`, then re-run `./scripts/install-launchd.sh`.

| Setting  | Default                | What it does          |
| -------- | ---------------------- | --------------------- |
| `PORT`   | `6464`                 | Port the page runs on |
| `GH_BIN` | `/opt/homebrew/bin/gh` | Where `gh` lives      |

These live in `.env`. See `.env.example` for details:

| Setting                                    | Default                            | What it does                                                 |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------ |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | none                               | The chat box. Hidden unless all three are set                |
| `LINEAR_API_KEY`, `LINEAR_WORKSPACE`       | none                               | The Linear column and PR-to-issue links. Hidden without both |
| `CAPTURE_DIR`                              | `~/obsidian/Plain/Weekly Notes`    | Folder of weekly notes for quick capture                     |
| `GREETING_NAME`                            | your GitHub name                   | Name in the greeting                                         |
| `GH_SEARCH_FILTER`                         | none                               | Extra GitHub search qualifiers, e.g. `org:acme`              |
| `VITE_SEARCH_URL`                          | `https://www.google.com/search?q=` | Search engine; the query is appended to this URL             |

Run `pnpm build` again after changing `VITE_SEARCH_URL`. It is baked into the page at build time.

## After updating

The page keeps running the old version until you rebuild and restart it:

```sh
pnpm build
pnpm reload
```

`pnpm reload` restarts the launchd service. Run it alone after changing `.env`.

## Troubleshooting

- **Calendar says "timed out" or "access denied".** Run `./bin/agenda` in a terminal and click Allow. Rebuilding the helper can make macOS ask again.
- **No pull requests.** Run `gh auth status`. Your org may need SSO authorized for the `gh` token.
- **No chat box or Linear column.** Its settings are missing from `.env`. Add them, then run `pnpm reload`.
- **Quick capture fails.** Check that `CAPTURE_DIR` exists. The first capture of a week also needs `template.md` in it.
- **Moved the repo or switched Node managers.** Re-run `./scripts/install-launchd.sh`.
- **Logs** are in `~/Library/Logs/browser-home.log`.

## Uninstall

```sh
launchctl bootout gui/$(id -u)/com.ndom91.browser-home
rm ~/Library/LaunchAgents/com.ndom91.browser-home.plist
```

Working on the code? See [AGENTS.md](AGENTS.md).
