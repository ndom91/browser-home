// How long each source stays fresh. The server cache and the client queries
// share this, so a new tab trusts the server-rendered data until it expires.
export const TTL = {
  calendar: 60_000,
  prs: 2 * 60_000,
  hn: 5 * 60_000,
  viewer: 24 * 60 * 60_000,
}
