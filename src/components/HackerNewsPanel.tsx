import { age, plural } from "../lib/format"
import type { Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import { HackerNewsIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"

interface Props {
  stories: Array<Story> | undefined
  error: unknown
}

export function HackerNewsPanel({ stories, error }: Props) {
  const now = useNow()
  return (
    <Panel id="hn" icon={<HackerNewsIcon />} title="Hacker News" meta={stories ? `Top ${stories.length}` : undefined}>
      {!stories ? (
        <PanelFallback error={error} />
      ) : (
        <ol className="hn-list">
          {stories.map((s, i) => (
            <li key={s.id} className="hn-item">
              <span className="hn-rank mono">{i + 1}</span>
              <div className="hn-main">
                <a className="hn-title" href={s.url}>
                  {s.title}
                </a>
                <p className="hn-meta">
                  <span>{s.domain}</span>
                  <span>{plural(s.points, "pt")}</span>
                  <a href={s.discussion}>{plural(s.comments, "comment")}</a>
                  <span>{age(s.time, now)}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
