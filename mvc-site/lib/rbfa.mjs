// The only place in this app that talks to the RBFA datalake.
//
// Two hard-won facts about that API:
//  1. RBFA mints a NEW teamId every season. The clubId is stable. Never hardcode a teamId.
//     -> clubTeams(clubId) gives the current season's teamId; old teamIds keep serving
//        their own season's data (calendar/members/rankings) until RBFA prunes them.
//  2. RBFA prunes: matchDetail returns null for past seasons, teamCalendar goes empty,
//     teamMembers goes null before a squad is published. So this sync only ever adds or
//     updates rows — it never deletes, and never overwrites a value we have with null.
//     Our database is the archive; RBFA is just the feed.

import { brusselsToUtc, seasonOf } from './time.mjs'

export { seasonOf }

const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'

export const CLUB_ID = '9143' // MVC DEN DERDE HELFT

export async function rbfaQuery(query) {
  const res = await fetch(RBFA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

// --- pure helpers (covered by scripts/check-rbfa.mjs) ---

// NOTE: brusselsToUtc() below is only ever handed a *raw RBFA* startTime, which has no
// zone ("2026-09-09T21:00:00") and means Brussels wall-clock time. Never pass it a value
// read back from our database — those are already UTC instants.

// A planned match still comes back with outcome: { homeTeamGoals: null, awayTeamGoals: null },
// so `outcome != null` is NOT a result — checking that marks every future fixture finished.
export function hasScore(m) {
  return m.outcome?.homeTeamGoals != null && m.outcome?.awayTeamGoals != null
}

// RBFA states seen in the wild: 'planned', 'live', 'finished'. Fall back to the clock,
// because 'planned' sticks around long after a match has actually been played.
export function deriveState(m, now = new Date()) {
  if (m.state === 'finished' || hasScore(m)) return 'finished'
  const diffMs = now.getTime() - brusselsToUtc(m.startTime).getTime()
  if (diffMs > 3 * 3600000) return 'finished'
  if (diffMs > -600000) return 'live' // from 10 min before kickoff
  return 'upcoming'
}

// A match is "in the live window" when its cards/score are still worth re-fetching.
export function inLiveWindow(startTime, now = new Date()) {
  const diffMs = now.getTime() - brusselsToUtc(startTime).getTime()
  return diffMs >= -3600000 && diffMs <= 4 * 3600000
}

const nameKey = (first, last) => `${first ?? ''} ${last ?? ''}`.toLowerCase().trim()

// supabase-js returns errors instead of throwing, and a swallowed upsert error is exactly
// how the RBFA card sync stayed broken unnoticed. Surface it in the sync report.
async function upsert(db, table, rows, options, results) {
  if (rows.length === 0) return false
  const { error } = await db.from(table).upsert(rows, options)
  if (error) {
    results.push(`FOUT bij ${table}: ${error.message}`)
    return false
  }
  return true
}

// --- queries ---

const calendarQuery = (teamId) => `
  query {
    teamCalendar(teamId: "${teamId}", language: nl, sortByDate: asc) {
      id state startTime
      homeTeam { id name }
      awayTeam { id name }
      outcome { homeTeamGoals awayTeamGoals }
      series { id name }
      location { name }
    }
  }
`

const membersQuery = (teamId) => `
  query { teamMembers(teamId: "${teamId}", language: nl) { players { id firstName lastName } } }
`

const rankingsQuery = (teamId) => `
  query {
    teamSeriesAndRankings(teamId: "${teamId}", language: nl) {
      series { name serieId }
      rankings { rankings { teams { name logo position points } } }
    }
  }
`

const detailQuery = (matchId) => `
  query {
    matchDetail(matchId: "${matchId}", language: nl) {
      id state homeTeam { id } awayTeam { id }
      lineup { home { id firstName lastName } away { id firstName lastName } }
      substitutes { home { id firstName lastName } away { id firstName lastName } }
      events {
        ... on GroupedEvents {
          home { kind minute lastName firstName teamId }
          away { kind minute lastName firstName teamId }
        }
      }
    }
  }
`

// --- team ids ---

export async function currentTeamIds() {
  const data = await rbfaQuery(`query { clubTeams(clubId: "${CLUB_ID}", language: nl) { id name } }`)
  return (data.clubTeams ?? []).map((t) => t.id)
}

// Every teamId we have ever synced is already recorded in the matches table (our side of
// each fixture), so past seasons keep getting refreshed without a separate registry table.
export async function knownTeamIds(db) {
  const { data } = await db.from('matches').select('is_home_game, home_team_rbfa_id, away_team_rbfa_id')
  const ids = new Set()
  for (const r of data ?? []) {
    const ours = r.is_home_game ? r.home_team_rbfa_id : r.away_team_rbfa_id
    if (ours) ids.add(ours)
  }
  return [...ids]
}

export async function resolveTeamIds(db) {
  const [current, known] = await Promise.all([currentTeamIds(), knownTeamIds(db)])
  return [...new Set([...current, ...known])]
}

// Which season each teamId belongs to, taken from its earliest match we know about.
async function seasonByTeamId(db, teamIds) {
  const { data } = await db.from('matches').select('is_home_game, home_team_rbfa_id, away_team_rbfa_id, start_time')
  const earliest = new Map()
  for (const r of data ?? []) {
    const ours = r.is_home_game ? r.home_team_rbfa_id : r.away_team_rbfa_id
    if (!ours) continue
    const prev = earliest.get(ours)
    if (!prev || r.start_time < prev) earliest.set(ours, r.start_time)
  }
  const out = new Map()
  for (const id of teamIds) {
    const first = earliest.get(id)
    out.set(id, first ? seasonOf(first) : seasonOf(new Date().toISOString()))
  }
  return out
}

// --- sync ---

export async function syncRbfa(db, { detailBudget = 8, now = new Date() } = {}) {
  const results = []
  const stamp = now.toISOString()

  const teamIds = await resolveTeamIds(db)
  results.push(`Teams: ${teamIds.join(', ')}`)

  // 1. Players. teamMembers is null until a squad is published — leave what we have.
  for (const teamId of teamIds) {
    const data = await rbfaQuery(membersQuery(teamId))
    const players = data.teamMembers?.players ?? []
    await upsert(
      db,
      'players',
      players.map((p) => ({
        rbfa_id: p.id,
        first_name: p.firstName,
        last_name: p.lastName,
        synced_at: stamp,
      })),
      { onConflict: 'rbfa_id' },
      results
    )
    results.push(`Team ${teamId}: ${players.length} spelers`)
  }

  // 2. Calendars of every season we track.
  const incoming = []
  for (const teamId of teamIds) {
    const data = await rbfaQuery(calendarQuery(teamId))
    const cal = data.teamCalendar ?? []
    for (const m of cal) incoming.push({ teamId, m })
    results.push(`Team ${teamId}: ${cal.length} wedstrijden`)
  }

  const { data: existing } = await db.from('matches').select('*')
  const prevByRbfaId = new Map((existing ?? []).map((r) => [r.rbfa_id, r]))

  if (incoming.length > 0) {
    const rows = incoming.map(({ teamId, m }) => {
      const prev = prevByRbfaId.get(m.id)
      const state = deriveState(m, now)
      const kickoff = brusselsToUtc(m.startTime)
      return {
        rbfa_id: m.id,
        home_team_name: m.homeTeam?.name ?? prev?.home_team_name ?? '?',
        away_team_name: m.awayTeam?.name ?? prev?.away_team_name ?? '?',
        home_team_rbfa_id: m.homeTeam?.id ?? prev?.home_team_rbfa_id ?? null,
        away_team_rbfa_id: m.awayTeam?.id ?? prev?.away_team_rbfa_id ?? null,
        start_time: m.startTime ? brusselsToUtc(m.startTime).toISOString() : prev?.start_time,
        // Never walk a played match back to upcoming, and never drop a score or a series
        // name that RBFA has stopped reporting. 'finished' only sticks for a match whose
        // kickoff has actually passed, so a wrong 'finished' on a future fixture heals.
        state: prev?.state === 'finished' && kickoff <= now ? 'finished' : state,
        series_name: m.series?.name ?? prev?.series_name ?? null,
        location_name: m.location?.name ?? prev?.location_name ?? null,
        is_home_game: m.homeTeam?.id === teamId,
        rbfa_home_score: m.outcome?.homeTeamGoals ?? prev?.rbfa_home_score ?? null,
        rbfa_away_score: m.outcome?.awayTeamGoals ?? prev?.rbfa_away_score ?? null,
        synced_at: stamp,
      }
    })
    await upsert(db, 'matches', rows, { onConflict: 'rbfa_id' }, results)
  }

  // Matches RBFA dropped keep their row, but must not stay 'upcoming' forever.
  const { error: staleErr } = await db
    .from('matches')
    .update({ state: 'finished' })
    .neq('state', 'finished')
    .lt('start_time', new Date(now.getTime() - 6 * 3600000).toISOString())
  if (staleErr) results.push(`FOUT bij matches (state): ${staleErr.message}`)

  // 3. Lineups and cards. RBFA returns matchDetail: null for past seasons, so this is the
  // only chance to archive a lineup — fetch it as soon as a match is played, and re-fetch
  // while the match is still in its live window.
  const { data: matchRows } = await db.from('matches').select('id, rbfa_id')
  const idByRbfaId = new Map((matchRows ?? []).map((r) => [r.rbfa_id, r.id]))

  const { data: lineupRows } = await db.from('match_players').select('match_id').eq('source', 'rbfa')
  const haveLineup = new Set((lineupRows ?? []).map((r) => r.match_id))

  const { data: playerRows } = await db.from('players').select('id, first_name, last_name')
  const playerByFullName = new Map((playerRows ?? []).map((p) => [nameKey(p.first_name, p.last_name), p.id]))
  const playerByLastName = new Map((playerRows ?? []).map((p) => [nameKey('', p.last_name), p.id]))

  const wanted = incoming.filter(({ m }) => {
    const matchId = idByRbfaId.get(m.id)
    if (!matchId) return false
    if (inLiveWindow(m.startTime, now)) return true
    return deriveState(m, now) === 'finished' && !haveLineup.has(matchId)
  })
  const todo = wanted.slice(0, detailBudget)
  if (wanted.length > todo.length) {
    results.push(`Details: ${todo.length}/${wanted.length} deze run, rest bij volgende sync`)
  }

  let lineupCount = 0
  let cardCount = 0
  for (const { teamId, m } of todo) {
    const matchId = idByRbfaId.get(m.id)
    const detail = (await rbfaQuery(detailQuery(m.id))).matchDetail
    if (!detail) continue // pruned by RBFA — whatever we already stored stands

    const ourSide = detail.homeTeam?.id === teamId ? 'home' : 'away'
    const squad = [...(detail.lineup ?? []), ...(detail.substitutes ?? [])]
      .map((g) => g?.[ourSide])
      .filter(Boolean)

    // Lineup ids come from a different id space than teamMembers, so match on name.
    const selection = []
    for (const p of squad) {
      const playerId = playerByFullName.get(nameKey(p.firstName, p.lastName))
      if (playerId) selection.push({ match_id: matchId, player_id: playerId, source: 'rbfa' })
    }
    if (await upsert(db, 'match_players', selection, { onConflict: 'match_id,player_id', ignoreDuplicates: true }, results)) {
      lineupCount += selection.length
    }

    const cards = []
    for (const group of detail.events ?? []) {
      for (const ev of [...(group.home ?? []), ...(group.away ?? [])]) {
        if (ev.kind !== 'yellow' && ev.kind !== 'red') continue
        cards.push({
          match_id: matchId,
          player_id: playerByLastName.get(nameKey('', ev.lastName)) ?? null,
          player_name_rbfa: `${ev.firstName} ${ev.lastName}`.trim(),
          minute: ev.minute,
          card_type: ev.kind,
          source: 'rbfa',
          rbfa_event_key: `${m.id}-${ev.teamId}-${ev.lastName}-${ev.minute}-${ev.kind}`,
        })
      }
    }
    if (await upsert(db, 'cards', cards, { onConflict: 'rbfa_event_key', ignoreDuplicates: true }, results)) {
      cardCount += cards.length
    }
  }
  if (todo.length > 0) results.push(`${todo.length} matchdetails: ${lineupCount} selecties, ${cardCount} kaarten`)

  results.push(...(await snapshotRankings(db, teamIds)))
  return results
}

// Standings live only as long as RBFA serves them, so every run snapshots them per season.
export async function snapshotRankings(db, teamIds) {
  const results = []
  const seasons = await seasonByTeamId(db, teamIds)

  for (const teamId of teamIds) {
    const data = await rbfaQuery(rankingsQuery(teamId))
    const series = data.teamSeriesAndRankings?.series ?? []
    const rankings = data.teamSeriesAndRankings?.rankings ?? []
    const season = seasons.get(teamId)

    const rows = []
    series.forEach((s, i) => {
      for (const t of rankings[i]?.rankings?.[0]?.teams ?? []) {
        rows.push({
          season,
          serie_id: s.serieId,
          serie_name: s.name,
          position: t.position,
          team_name: t.name,
          team_logo: t.logo || null,
          points: t.points,
        })
      }
    })

    if (await upsert(db, 'rankings_snapshots', rows, { onConflict: 'season,serie_id,team_name' }, results)) {
      results.push(`Standen ${season}: ${rows.length} rijen`)
    }
  }
  return results
}
