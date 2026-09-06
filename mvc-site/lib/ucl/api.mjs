// football-data.org client. Server-side only — the API key must never reach the browser.
//
// Free tier allows 10 requests per minute, so the sync makes exactly one call per run and
// caches everything in ucl_matches. The browser then reads our own database, never the API.

const BASE = 'https://api.football-data.org/v4'
export const COMPETITION = 'CL'

export async function fetchMatches(apiKey) {
  if (!apiKey) throw new Error('FOOTBALL_API_KEY is not set')
  const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
    headers: { 'X-Auth-Token': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`football-data ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.matches ?? []
}

/** Season label from the API's season object, e.g. "2026-2027". */
function seasonLabel(m) {
  const start = m.season?.startDate?.slice(0, 4)
  const end = m.season?.endDate?.slice(0, 4)
  return start && end ? `${start}-${end}` : null
}

/** API shape -> our row shape. */
export function toRow(m) {
  return {
    id: m.id,
    competition: COMPETITION,
    season: seasonLabel(m),
    stage: m.stage ?? null,
    matchday: m.matchday ?? null,
    utc_kickoff: m.utcDate,
    home_team: m.homeTeam?.name ?? m.homeTeam?.shortName ?? 'Onbekend',
    away_team: m.awayTeam?.name ?? m.awayTeam?.shortName ?? 'Onbekend',
    home_crest: m.homeTeam?.crest ?? null,
    away_crest: m.awayTeam?.crest ?? null,
    status: m.status,
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
  }
}

/**
 * The matches to offer for prediction: everything in the same stage and matchday as the
 * earliest match that has not finished.
 *
 * The bot grouped by (stage, matchday) and returned the first group satisfying a set of
 * conditions while iterating a dictionary, which depended on insertion order. Anchoring on
 * the earliest unfinished kickoff is deterministic and gives the same answer in practice.
 */
export function currentMatchday(rows, now = new Date()) {
  const unfinished = rows
    .filter((r) => r.status !== 'FINISHED' && r.utc_kickoff)
    .sort((a, b) => new Date(a.utc_kickoff) - new Date(b.utc_kickoff))

  // Prefer the next kickoff; mid-matchday fall back to the earliest unfinished one; once the
  // season is over anchor on the last match played, so the screen shows the final matchday
  // (locked) instead of nothing at all.
  const latestFinished = rows
    .filter((r) => r.utc_kickoff)
    .sort((a, b) => new Date(b.utc_kickoff) - new Date(a.utc_kickoff))[0]

  const anchor =
    unfinished.find((r) => new Date(r.utc_kickoff) > now) ?? unfinished[0] ?? latestFinished
  if (!anchor) return { stage: null, matchday: null, matches: [] }

  const matches = rows
    .filter((r) => r.stage === anchor.stage && r.matchday === anchor.matchday)
    .sort((a, b) => new Date(a.utc_kickoff) - new Date(b.utc_kickoff))

  return { stage: anchor.stage, matchday: anchor.matchday, matches }
}
