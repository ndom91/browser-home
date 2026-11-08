import type { SVGProps } from "react"
import type { WeatherKind } from "../lib/weather"

type IconProps = SVGProps<SVGSVGElement>

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
} as const

export function CalendarIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <rect x="1.25" y="2.5" width="13.5" height="12.25" rx="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.25 6.25h13.5M5 1v2.75M11 1v2.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="4" y="8.5" width="2.25" height="2.25" rx=".4" fill="currentColor" />
    </svg>
  )
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  )
}

export function HackerNewsIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <rect width="16" height="16" rx="3" fill="var(--hn-accent)" />
      <path d="M5 4l3 4.5L11 4M8 8.5V12" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path
        d="M5 11l6-6M6 5h5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Open PR: ring with a centre dot. */
export function PullRequestIcon({ draft, ...props }: IconProps & { draft?: boolean }) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <circle
        cx="8"
        cy="8"
        r="5.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={draft ? "2.2 2" : undefined}
      />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" />
    </svg>
  )
}

const CLOUD = "M4.6 13h6.9a2.6 2.6 0 0 0 .35-5.18A3.6 3.6 0 0 0 4.9 8.3 2.35 2.35 0 0 0 4.6 13z"
const CLOUD_HIGH = "M4.6 10.5h6.9a2.6 2.6 0 0 0 .35-5.18A3.6 3.6 0 0 0 4.9 5.8 2.35 2.35 0 0 0 4.6 10.5z"
const line = { stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const

export function WeatherIcon({ kind, ...props }: IconProps & { kind: WeatherKind }) {
  return (
    <svg aria-hidden="true" {...base} width={16} height={16} {...props}>
      {kind === "clear" && (
        <>
          <circle cx="8" cy="8" r="2.9" stroke="var(--weather-sun)" strokeWidth="1.3" />
          <path
            d="M8 1.6v1.3M8 13.1v1.3M1.6 8h1.3M13.1 8h1.3M3.5 3.5l.9.9M11.6 11.6l.9.9M3.5 12.5l.9-.9M11.6 4.4l.9-.9"
            {...line}
            stroke="var(--weather-sun)"
          />
        </>
      )}
      {kind === "partly" && (
        <>
          <circle cx="5.6" cy="5.4" r="2.1" stroke="var(--weather-sun)" strokeWidth="1.3" />
          <path d="M5.6 1.4v.8M1.6 5.4h.8M2.8 2.6l.55.55M8.4 2.6l-.55.55" {...line} stroke="var(--weather-sun)" />
          {/* Filled with the page color, so the cloud hides the sun behind it. */}
          <path d={CLOUD} {...line} fill="var(--bg)" />
        </>
      )}
      {kind === "cloudy" && <path d={CLOUD} {...line} />}
      {kind === "fog" && <path d="M2.5 5.5h11M1.5 8.5h13M3.5 11.5h9" {...line} />}
      {kind === "rain" && (
        <>
          <path d={CLOUD_HIGH} {...line} />
          <path d="M5.5 12.5l-.6 1.6M8.5 12.5l-.6 1.6M11.5 12.5l-.6 1.6" {...line} stroke="var(--weather-rain)" />
        </>
      )}
      {kind === "snow" && (
        <>
          <path d={CLOUD_HIGH} {...line} />
          <g fill="currentColor">
            <circle cx="5.2" cy="13.2" r=".8" />
            <circle cx="8.2" cy="14.2" r=".8" />
            <circle cx="11.2" cy="13.2" r=".8" />
          </g>
        </>
      )}
      {kind === "storm" && (
        <>
          <path d={CLOUD_HIGH} {...line} />
          <path d="M8.6 10.8l-1.8 2.4h2.2l-1.6 2.3" {...line} stroke="var(--weather-sun)" />
        </>
      )}
    </svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path
        d="M13 8H3.5M7.5 4L3.5 8l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SparkHexIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <path
        d="M8 1.75l5.4 3.1v6.3L8 14.25l-5.4-3.1v-6.3L8 1.75z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.6 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path
        d="M8 13V3.5M4 7.5l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={10} height={10} {...props}>
      <rect x="2" y="2" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FilterIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={13} height={13} {...props}>
      <path
        d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71M13.25 2.5v2.75H10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Linear-style priority: "!" box for urgent, 1–3 bars for low to high, a dash for none. */
export function PriorityIcon({ priority, ...props }: IconProps & { priority: number }) {
  if (priority === 1) {
    return (
      <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
        <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--fail)" />
        <path d="M8 4.5v4.5M8 11.5v.01" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  if (priority === 0) {
    return (
      <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
        <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      </svg>
    )
  }
  const filled = 5 - priority // high 3, medium 2, low 1
  return (
    <svg aria-hidden="true" {...base} width={12} height={12} {...props}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.5}
          y={10 - i * 3.5}
          width="3"
          height={4 + i * 3.5}
          rx="1"
          fill="currentColor"
          opacity={i < filled ? 1 : 0.25}
        />
      ))}
    </svg>
  )
}

/** Linear-style mark: a disc cut by diagonal lines. */
export function LinearIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <circle cx="8" cy="8" r="6.75" fill="currentColor" />
      <path d="M2.5 9.5l4 4M1.75 6.5l7.75 7.75M3.25 3.75l9 9" stroke="var(--panel)" strokeWidth="1.1" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} width={10} height={10} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function CommentIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <path
        d="M3 2.75h10c.97 0 1.75.78 1.75 1.75v5.5c0 .97-.78 1.75-1.75 1.75H7.5l-3.25 2.5v-2.5H3c-.97 0-1.75-.78-1.75-1.75V4.5c0-.97.78-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AtIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.6 8v1.1a1.95 1.95 0 0 0 3.9 0V8A6.5 6.5 0 1 0 12 13.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" {...base} {...props}>
      <path
        d="M1.25 8h3l2-4.75 3.5 9.5 2-4.75h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
