import { NextResponse } from 'next/server'
import { rbfaQuery, TEAM_ID } from '@/lib/rbfa'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SERIES_RANKINGS_QUERY = `
  query GetSeriesRankings($seriesId: ID!) {
    seriesRankings(seriesId: $seriesId, language: nl) {
      rankings {
        teams {
          id
          name
          logo
          position
          points
          gamesPlayed
          wins
          draws
          losses
          goalsFor
          goalsAgainst
        }
      }
    }
  }
`

const TEAM_SERIES_QUERY = `
  query {
    teamSeriesAndRankings(teamId: "${TEAM_ID}", language: nl) {
      series { name serieId }
    }
  }
`

export async function GET() {
  try {
    // 1. Get all series for our team
    const seriesData = await rbfaQuery(TEAM_SERIES_QUERY)
    const seriesList: Array<{ name: string; serieId: string }> =
      seriesData?.teamSeriesAndRankings?.series ?? []

    // 2. For each series, fetch the full rankings
    const rankingsPerSeries = await Promise.all(
      seriesList.map(async (s) => {
        try {
          const data = await rbfaQuery(SERIES_RANKINGS_QUERY, { seriesId: s.serieId })
          const teams = data?.seriesRankings?.rankings?.[0]?.teams ?? []
          return { serieId: s.serieId, name: s.name, teams }
        } catch {
          return { serieId: s.serieId, name: s.name, teams: [] }
        }
      })
    )

    // 3. Load our finished matches from Supabase for H2H + form
    const { data: finishedMatches } = await supabaseAdmin
      .from('matches')
      .select('id, home_team_name, away_team_name, home_team_rbfa_id, away_team_rbfa_id, is_home_game, rbfa_home_score, rbfa_away_score, manual_home_score, manual_away_score, start_time, state')
      .eq('state', 'finished')
      .order('start_time', { ascending: false })

    return NextResponse.json({
      series: rankingsPerSeries,
      ourMatches: finishedMatches ?? [],
    })
  } catch (err) {
    console.error('rbfa-rankings error:', err)
    return NextResponse.json({ error: 'Failed to load rankings' }, { status: 500 })
  }
}
