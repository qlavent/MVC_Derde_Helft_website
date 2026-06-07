import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'
const TEAM_ID = '345149'
const OUR_TEAM_RBFA_ID = '345149'

async function rbfaQuery(query: string) {
  const res = await fetch(RBFA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const results: string[] = []

  try {
    // 1. Sync players
    const membersData = await rbfaQuery(`query { teamMembers(teamId: "${TEAM_ID}", language: nl) { players { id firstName lastName } } }`)
    const players = membersData.teamMembers?.players ?? []
    for (const p of players) {
      await supabase.from('players').upsert(
        { rbfa_id: p.id, first_name: p.firstName, last_name: p.lastName, synced_at: new Date().toISOString() },
        { onConflict: 'rbfa_id' }
      )
    }
    results.push(`${players.length} spelers gesynchroniseerd`)

    // 2. Sync match calendar
    const calData = await rbfaQuery(`
      query {
        teamCalendar(teamId: "${TEAM_ID}", language: nl, sortByDate: asc) {
          id state startTime
          homeTeam { id name }
          awayTeam { id name }
          outcome { homeTeamGoals awayTeamGoals }
          series { id name }
        }
      }
    `)
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
          state: (() => {
            if (m.state === 'finished' || m.outcome != null) return 'finished'
            const start = new Date(m.startTime)
            const now = new Date()
            const diffMs = now.getTime() - start.getTime()
            if (diffMs > 3600000) return 'finished'
            if (diffMs > 0) return 'live'
            return 'upcoming'
          })(),
          series_name: m.series?.name ?? null,
          is_home_game: isHome,
          rbfa_home_score: m.outcome?.homeTeamGoals ?? null,
          rbfa_away_score: m.outcome?.awayTeamGoals ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'rbfa_id' }
      )
    }
    results.push(`${matches.length} wedstrijden gesynchroniseerd`)

    // 3. Sync lineup + cards for all finished matches (lineup) and time-window matches (cards)
    const now = new Date()
    const windowMatches = matches.filter((m: { startTime: string }) => {
      const start = new Date(m.startTime)
      const diffMs = now.getTime() - start.getTime()
      return diffMs >= -3600000 && diffMs <= 14400000
    })

    for (const m of matches) {
      const detail = await rbfaQuery(`
        query {
          matchDetail(matchId: "${m.id}", language: nl) {
            id state homeTeam { id } awayTeam { id }
            lineup {
              home { id firstName lastName shirtNumber }
              away { id firstName lastName shirtNumber }
            }
            substitutes {
              home { id firstName lastName shirtNumber }
              away { id firstName lastName shirtNumber }
            }
            events {
              ... on GroupedEvents {
                home { kind minute lastName firstName teamId }
                away { kind minute lastName firstName teamId }
              }
            }
          }
        }
      `)

      const { data: matchRow } = await supabase.from('matches').select('id').eq('rbfa_id', m.id).single()
      if (!matchRow) continue

      // Sync lineup (starters + subs) as match_players
      const homeId = detail.matchDetail?.homeTeam?.id
      const ourSide = homeId === OUR_TEAM_RBFA_ID ? 'home' : 'away'
      const lineupRows: { id: string }[] = [
        ...(detail.matchDetail?.lineup ?? []).map((g: { home?: { id: string }; away?: { id: string } }) => g[ourSide]).filter(Boolean),
        ...(detail.matchDetail?.substitutes ?? []).map((g: { home?: { id: string }; away?: { id: string } }) => g[ourSide]).filter(Boolean),
      ]
      for (const lp of lineupRows) {
        const { data: player } = await supabase.from('players').select('id').eq('rbfa_id', lp.id).maybeSingle()
        if (!player) continue
        await supabase.from('match_players').upsert(
          { match_id: matchRow.id, player_id: player.id, source: 'rbfa' },
          { onConflict: 'match_id,player_id', ignoreDuplicates: true }
        )
      }

      // Only sync cards for matches in time window
      if (!windowMatches.some((wm: { id: string }) => wm.id === m.id)) continue

      const events = detail.matchDetail?.events ?? []
      for (const group of events) {
        const allEvents = [...(group.home ?? []), ...(group.away ?? [])]
        for (const ev of allEvents) {
          if (ev.kind !== 'yellow' && ev.kind !== 'red') continue
          const key = `${m.id}-${ev.teamId}-${ev.lastName}-${ev.minute}-${ev.kind}`
          const { data: player } = await supabase.from('players').select('id').ilike('last_name', ev.lastName).maybeSingle()
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
    }
    if (windowMatches.length > 0) results.push(`Kaarten gesynchroniseerd voor ${windowMatches.length} wedstrijden`)

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
