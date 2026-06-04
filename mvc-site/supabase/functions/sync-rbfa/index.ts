import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'
const TEAM_ID = '345149'
const OUR_TEAM_RBFA_ID = '345149'

async function rbfaQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(RBFA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

const CALENDAR_QUERY = `
  query {
    teamCalendar(teamId: "${TEAM_ID}", language: nl, sortByDate: asc) {
      id state startTime
      homeTeam { id name }
      awayTeam { id name }
      outcome { homeTeamGoals awayTeamGoals }
      series { id name }
    }
  }
`

const MEMBERS_QUERY = `
  query {
    teamMembers(teamId: "${TEAM_ID}", language: nl) {
      players { id firstName lastName }
    }
  }
`

function matchDetailQuery(matchId: string) {
  return `
    query {
      matchDetail(matchId: "${matchId}", language: nl) {
        id state
        events {
          ... on GroupedEvents {
            home { kind minute lastName firstName teamId }
            away { kind minute lastName firstName teamId }
          }
        }
      }
    }
  `
}

const SELECTION_QUERY = `
  query {
    playerSelection(teamId: "${TEAM_ID}", language: nl) {
      __typename
    }
  }
`

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const results: string[] = []

  try {
    // 1. Sync players
    const membersData = await rbfaQuery(MEMBERS_QUERY)
    const players = membersData.teamMembers?.players ?? []
    for (const p of players) {
      await supabase.from('players').upsert(
        { rbfa_id: p.id, first_name: p.firstName, last_name: p.lastName, synced_at: new Date().toISOString() },
        { onConflict: 'rbfa_id' }
      )
    }
    results.push(`Synced ${players.length} players`)

    // 2. Sync match calendar
    const calData = await rbfaQuery(CALENDAR_QUERY)
    const matches = calData.teamCalendar ?? []
    for (const m of matches) {
      const isHome = m.homeTeam.id === OUR_TEAM_RBFA_ID
      await supabase.from('matches').upsert(
        {
          rbfa_id: m.id,
          home_team_name: m.homeTeam.name,
          away_team_name: m.awayTeam.name,
          home_team_rbfa_id: m.homeTeam.id,
          away_team_rbfa_id: m.awayTeam.id,
          start_time: m.startTime,
          state: m.state === 'finished' ? 'finished' : m.state === 'live' ? 'live' : 'upcoming',
          series_name: m.series?.name ?? null,
          is_home_game: isHome,
          rbfa_home_score: m.outcome?.homeTeamGoals ?? null,
          rbfa_away_score: m.outcome?.awayTeamGoals ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'rbfa_id' }
      )
    }
    results.push(`Synced ${matches.length} matches`)

    // 3. For matches in the time window: sync cards
    const now = new Date()
    const windowMatches = matches.filter((m: { startTime: string }) => {
      const start = new Date(m.startTime)
      const diffMs = now.getTime() - start.getTime()
      const oneHourMs = 60 * 60 * 1000
      return diffMs >= -oneHourMs && diffMs <= 4 * oneHourMs
    })

    for (const m of windowMatches) {
      const detail = await rbfaQuery(matchDetailQuery(m.id))
      const events = detail.matchDetail?.events ?? []

      // Get our match row
      const { data: matchRow } = await supabase
        .from('matches')
        .select('id')
        .eq('rbfa_id', m.id)
        .single()

      if (!matchRow) continue

      for (const group of events) {
        const allEvents = [...(group.home ?? []), ...(group.away ?? [])]
        for (const ev of allEvents) {
          if (ev.kind !== 'yellow' && ev.kind !== 'red') continue
          const key = `${m.id}-${ev.teamId}-${ev.lastName}-${ev.minute}-${ev.kind}`
          // Try to match player in our DB
          const { data: player } = await supabase
            .from('players')
            .select('id')
            .ilike('last_name', ev.lastName)
            .maybeSingle()

          await supabase.from('cards').upsert(
            {
              match_id: matchRow.id,
              player_id: player?.id ?? null,
              player_name_rbfa: `${ev.firstName} ${ev.lastName}`,
              minute: ev.minute,
              card_type: ev.kind,
              source: 'rbfa',
              rbfa_event_key: key,
            },
            { onConflict: 'rbfa_event_key', ignoreDuplicates: true }
          )
        }
      }
      results.push(`Synced detail for match ${m.id}`)
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
