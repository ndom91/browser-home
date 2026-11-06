// HN comment HTML uses a tiny tag set. Rebuild only those tags and drop the
// rest, so nothing from the API can inject scripts or styles. Text between
// tags arrives already entity-escaped, so it passes through unchanged.
const ALLOWED = new Set(["p", "i", "b", "em", "strong", "pre", "code", "br"])

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// Undo the entities HN uses inside href values before validating the scheme.
const decodeAttr = (value: string) =>
  value
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")

export function sanitizeHtml(html: string): string {
  return html.replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_match, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase()
    if (name === "a") {
      if (slash) return "</a>"
      const href = decodeAttr(attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? "")
      if (!/^https?:\/\//i.test(href)) return "<a>"
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">`
    }
    if (ALLOWED.has(name)) return name === "br" ? "<br>" : `<${slash}${name}>`
    return ""
  })
}
