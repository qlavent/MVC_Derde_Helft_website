import { NextResponse } from 'next/server'

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const season = searchParams.get('season') // e.g. "2024" for 2024-2025

  try {
    const seasonArg = season ? `, seasonYear: ${season}` : ''

    const seriesData = await rbfaQuery(`
      query {
        teamSeriesAndRankings(teamId: "${TEAM_ID}", language: nl${seasonArg}) {
          series { name serieId }
          rankings { rankings { teams { name logo position points } } }
        }
      }
    `)

    const { series, rankings } = seriesData.teamSeriesAndRankings

    const calData = await rbfaQuery(`
      query {
        teamCalendar(teamId: "${TEAM_ID}", language: nl, sortByDate: asc${seasonArg}) {
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
