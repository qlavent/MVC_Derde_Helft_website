import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { fetchMatches, toRow } from '@/lib/ucl/api.mjs'
import { pointsFor } from '@/lib/ucl/score.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pulls the Champions League fixtures and results, then scores any prediction whose match has
 * finished. One API call per run, well inside football-data.org's 10-per-minute free tier.
 *
 * Scoring is idempotent by construction: only predictions with points IS NULL are considered,
 * so a re-run cannot double-count and a partial failure simply finishes next time. The Discord
 * bot instead marked a match "processed" and incremented a running total per user, which loses
 * points if it fails midway.
 */
async function run() {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FOOTBALL_API_KEY not set' }, { status: 500 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const db = supabaseServer()
  const results: string[] = []

  try {
    const raw = await fetchMatches(apiKey)
    const rows = raw.map(toRow)
    results.push(`${rows.length} wedstrijden opgehaald`)

    if (rows.length > 0) {
      const { error } = await db
        .from('ucl_matches')
        .upsert(
          rows.map((r: Record<string, unknown>) => ({ ...r, synced_at: new Date().toISOString() })),
          { onConflict: 'id' }
        )
      if (error) return NextResponse.json({ error: `upsert: ${error.message}` }, { status: 500 })
    }

    // Score what is now scoreable. Finished matches only, unscored predictions only.
    const { data: finished, error: fErr } = await db
      .from('ucl_matches')
      .select('id, home_score, away_score')
      .eq('status', 'FINISHED')
      .not('home_score', 'is', null)
    if (fErr) return NextResponse.json({ error: `matches: ${fErr.message}` }, { status: 500 })

    const finishedIds = (finished ?? []).map((m) => m.id)
    let scored = 0

    if (finishedIds.length > 0) {
      const { data: pending, error: pErr } = await db
        .from('ucl_predictions')
        .select('id, match_id, home_goals, away_goals')
        .is('points', null)
        .in('match_id', finishedIds)
      if (pErr) return NextResponse.json({ error: `predictions: ${pErr.message}` }, { status: 500 })

      const scoreByMatch = new Map(
        (finished ?? []).map((m) => [m.id, { home: m.home_score, away: m.away_score }])
      )

      for (const p of pending ?? []) {
        const actual = scoreByMatch.get(p.match_id)
        if (!actual) continue
        const points = pointsFor(actual.home, actual.away, p.home_goals, p.away_goals)
        if (points === null) continue
        const { error: uErr } = await db.from('ucl_predictions').update({ points }).eq('id', p.id)
        if (uErr) {
          results.push(`FOUT bij voorspelling ${p.id}: ${uErr.message}`)
          continue
        }
        scored++
      }
    }

    results.push(scored > 0 ? `${scored} voorspellingen gescoord` : 'geen nieuwe voorspellingen te scoren')
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Scheduled run (pg_cron), same secret as the RBFA sync.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}

// Manual trigger, same secret — deliberately not open, so nobody can hammer the football API.
export async function POST(req: NextRequest) {
  return GET(req)
}
