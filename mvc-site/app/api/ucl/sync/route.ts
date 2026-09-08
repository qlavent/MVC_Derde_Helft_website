import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { fetchMatches, toRow } from '@/lib/ucl/api.mjs'
import { pointsFor } from '@/lib/ucl/score.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pulls the Champions League fixtures and results, then (re)scores every prediction whose match
 * has finished. One API call per run, well inside football-data.org's 10-per-minute free tier.
 *
 * Scoring recomputes from the freshly-upserted score on every run and writes only the rows whose
 * points actually changed. Two things fall out of that:
 *   - It is idempotent: an unchanged score produces no writes, so a re-run cannot double-count
 *     and a partial failure simply finishes next time.
 *   - It is self-correcting: football-data.org sometimes revises a full-time score after the
 *     final whistle (a disallowed goal, a VAR change, a provisional score fixed later). The
 *     match row already follows the API because it is re-upserted every run; recomputing points
 *     the same way means a corrected score re-scores the affected predictions automatically,
 *     instead of leaving people frozen on points from a score that no longer exists.
 *
 * The earlier version only touched predictions with points IS NULL, so a correction updated the
 * displayed score but never the points — exactly the drift this endpoint now repairs.
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

    // The scoreable universe: finished matches with a score. Every prediction on one of these
    // is (re)checked below against the score the API currently reports.
    const { data: finished, error: fErr } = await db
      .from('ucl_matches')
      .select('id, home_score, away_score')
      .eq('status', 'FINISHED')
      .not('home_score', 'is', null)
    if (fErr) return NextResponse.json({ error: `matches: ${fErr.message}` }, { status: 500 })

    const finishedIds = (finished ?? []).map((m) => m.id)
    let scored = 0
    let corrected = 0

    if (finishedIds.length > 0) {
      // Every prediction on a finished match — not just the unscored ones — so a revised score
      // can re-score predictions that were already given points.
      const { data: preds, error: pErr } = await db
        .from('ucl_predictions')
        .select('id, match_id, home_goals, away_goals, points')
        .in('match_id', finishedIds)
      if (pErr) return NextResponse.json({ error: `predictions: ${pErr.message}` }, { status: 500 })

      const scoreByMatch = new Map(
        (finished ?? []).map((m) => [m.id, { home: m.home_score, away: m.away_score }])
      )

      for (const p of preds ?? []) {
        const actual = scoreByMatch.get(p.match_id)
        if (!actual) continue
        const points = pointsFor(actual.home, actual.away, p.home_goals, p.away_goals)
        if (points === null) continue
        // Write only when the value actually changes: no-op re-runs make no writes, and a
        // corrected score rewrites exactly the affected rows.
        if (points === p.points) continue
        const wasScored = p.points !== null
        const { error: uErr } = await db.from('ucl_predictions').update({ points }).eq('id', p.id)
        if (uErr) {
          results.push(`FOUT bij voorspelling ${p.id}: ${uErr.message}`)
          continue
        }
        if (wasScored) corrected++
        else scored++
      }
    }

    results.push(scored > 0 ? `${scored} voorspellingen gescoord` : 'geen nieuwe voorspellingen te scoren')
    if (corrected > 0) results.push(`${corrected} voorspellingen gecorrigeerd na een gewijzigde uitslag`)
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
