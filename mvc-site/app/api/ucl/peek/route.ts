import { NextRequest, NextResponse } from 'next/server'
import { fetchMatches, toRow } from '@/lib/ucl/api.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// toRow lives in an untyped .mjs, so annotate the shape we rely on here.
type Row = {
  id: number
  utc_kickoff: string
  home_team: string
  away_team: string
  status: string
  home_score: number | null
  away_score: number | null
}

/**
 * Read-only look at what football-data.org returns RIGHT NOW. It makes one API call and returns
 * the scores; it never reads or writes the database. Its only purpose is to check whether the
 * provider has corrected a score (e.g. the AEK 2-0 that should be 1-0) before we let the sync
 * act on it.
 *
 * Protected by the same CRON_SECRET as /api/ucl/sync, for the same reason: it spends a
 * football-data.org request (free tier, 10/min), so it must not be left open to be hammered.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_SITE/api/ucl/peek?team=AEK
 *
 * Query params (all optional):
 *   team    substring match on either team name, case-insensitive (e.g. ?team=AEK)
 *   status  exact status filter (e.g. ?status=FINISHED)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FOOTBALL_API_KEY not set' }, { status: 500 })
  }

  const url = new URL(req.url)
  const team = (url.searchParams.get('team') ?? '').toLowerCase()
  const status = url.searchParams.get('status') ?? ''

  try {
    const rows = (await fetchMatches(apiKey)).map(toRow) as Row[]

    const filtered = rows
      .filter(
        (r) =>
          !team ||
          r.home_team.toLowerCase().includes(team) ||
          r.away_team.toLowerCase().includes(team)
      )
      .filter((r) => !status || r.status === status)
      .sort((a, b) => new Date(a.utc_kickoff).getTime() - new Date(b.utc_kickoff).getTime())
      .map((r) => ({
        id: r.id,
        kickoff: r.utc_kickoff,
        match: `${r.home_team} vs ${r.away_team}`,
        status: r.status,
        score: r.home_score == null ? null : `${r.home_score}-${r.away_score}`,
        home_score: r.home_score,
        away_score: r.away_score,
      }))

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      note: 'Live from football-data.org. The database was not read or written.',
      count: filtered.length,
      matches: filtered,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
