import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'
const TEAM_ID = '345149'

async function rbfaQuery(query: string) {
  const res = await fetch(RBFA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 3600 },
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

function currentSeason(): string {
  const now = new Date()
  const y = now.getFullYear()
  const startYear = now.getMonth() >= 7 ? y : y - 1
  return `${startYear}-${startYear + 1}`
}

export async function GET() {
  try {
    const db = supabaseServer()
    const season = currentSeason()

    const seriesData = await rbfaQuery(`
      query {
        teamSeriesAndRankings(teamId: "${TEAM_ID}", language: nl) {
          series { name serieId }
          rankings { rankings { teams { name logo position points } } }
        }
      }
    `)

    const { series, rankings } = seriesData.teamSeriesAndRankings

    // Snapshot into Supabase — upsert by season + serie_id + team_name
    const rows: {
      season: string
      serie_id: string
      serie_name: string
      position: number
      team_name: string
      team_logo: string | null
      points: number
    }[] = []

    series.forEach((s: { name: string; serieId: string }, si: number) => {
      const teams: { name: string; logo: string; position: number; points: number }[] =
        rankings[si]?.rankings?.[0]?.teams ?? []
      for (const t of teams) {
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

    if (rows.length > 0) {
      await db.from('rankings_snapshots').upsert(rows, { onConflict: 'season,serie_id,team_name' })
    }

    const calData = await rbfaQuery(`
      query {
        teamCalendar(teamId: "${TEAM_ID}", language: nl, sortByDate: asc) {
          id state homeTeam { id } awayTeam { id }
          outcome { homeTeamGoals awayTeamGoals }
        }
      }
    `)

    const finished = (calData.teamCalendar ?? []).filter((m: { state: string; outcome: unknown }) =>
      m.state === 'finished' && m.outcome
    )

    const last5 = finished.slice(-5).map((m: { homeTeam: { id: string }; outcome: { homeTeamGoals: number; awayTeamGoals: number } }) => {
      const isHome = m.homeTeam.id === TEAM_ID
      const our = isHome ? m.outcome.homeTeamGoals : m.outcome.awayTeamGoals
      const their = isHome ? m.outcome.awayTeamGoals : m.outcome.homeTeamGoals
      return our > their ? 'W' : our === their ? 'G' : 'V'
    })

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
    for (const m of finished as { homeTeam: { id: string }; outcome: { homeTeamGoals: number; awayTeamGoals: number } }[]) {
      const isHome = m.homeTeam.id === TEAM_ID
      const our = isHome ? m.outcome.homeTeamGoals : m.outcome.awayTeamGoals
      const their = isHome ? m.outcome.awayTeamGoals : m.outcome.homeTeamGoals
      goalsFor += our; goalsAgainst += their
      if (our > their) wins++; else if (our === their) draws++; else losses++
    }

    return NextResponse.json({
      series, rankings,
      ourStats: { played: finished.length, wins, draws, losses, goalsFor, goalsAgainst, points: wins * 3 + draws, form: last5 },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
