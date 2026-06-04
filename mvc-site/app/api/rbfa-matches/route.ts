import { NextResponse } from 'next/server'

const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'
const TEAM_ID = '345149'
const OUR_TEAM_RBFA_ID = '345149'

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

export async function GET() {
  try {
    const res = await fetch(RBFA_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: CALENDAR_QUERY }),
      next: { revalidate: 300 },
    })
    const json = await res.json()
    const raw = json.data?.teamCalendar ?? []

    const matches = raw.map((m: {
      id: string
      state: string
      startTime: string
      homeTeam: { id: string; name: string }
      awayTeam: { id: string; name: string }
      outcome?: { homeTeamGoals: number; awayTeamGoals: number } | null
      series?: { id: string; name: string } | null
    }) => ({
      id: m.id,
      rbfa_id: m.id,
      home_team_name: m.homeTeam.name,
      away_team_name: m.awayTeam.name,
      home_team_rbfa_id: m.homeTeam.id,
      away_team_rbfa_id: m.awayTeam.id,
      start_time: m.startTime,
      state: (m.state === 'finished' || (m.outcome != null) || new Date(m.startTime) < new Date()) ? 'finished' : m.state === 'live' ? 'live' : 'upcoming',
      series_name: m.series?.name ?? 'Kern Deinze',
      is_home_game: m.homeTeam.id === OUR_TEAM_RBFA_ID,
      rbfa_home_score: m.outcome?.homeTeamGoals ?? null,
      rbfa_away_score: m.outcome?.awayTeamGoals ?? null,
      manual_home_score: null,
      manual_away_score: null,
      instagram_post_url: null,
      synced_at: new Date().toISOString(),
    }))

    return NextResponse.json(matches)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
