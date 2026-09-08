// One-off diagnostic for the "wrong score / wrong points" problem.
//
//   node scripts/diagnose-ucl.mjs            all unfinished-or-recent matches + score/points audit
//   node scripts/diagnose-ucl.mjs AEK         only matches whose team name contains "AEK"
//
// Reads .env.local (FOOTBALL_API_KEY, and optionally NEXT_PUBLIC_SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY) so no secret has to be typed anywhere. It ONLY reads —
// it never writes to the API or the database.
//
// What it answers:
//   1. What does football-data.org currently return for the match (status + full-time score)?
//   2. What does our ucl_matches row currently hold (the cached score the app shows)?
//   3. Do any already-scored predictions disagree with the score the API now reports?
//      Those are the people who got wrong points and would be re-scored by the fix.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchMatches, toRow } from '../lib/ucl/api.mjs'
import { pointsFor } from '../lib/ucl/score.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// Minimal .env.local loader — no dependency on dotenv.
function loadEnv() {
  try {
    const text = readFileSync(join(here, '..', '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
}

loadEnv()

const filter = (process.argv[2] || '').toLowerCase()
const key = process.env.FOOTBALL_API_KEY
if (!key) {
  console.error('FOOTBALL_API_KEY is not set (put it in mvc-site/.env.local). Cannot query the API.')
  process.exit(1)
}

console.log('Fetching live Champions League data from football-data.org …\n')
const raw = await fetchMatches(key)
const rows = raw.map(toRow)

const match = (r) =>
  !filter || r.home_team.toLowerCase().includes(filter) || r.away_team.toLowerCase().includes(filter)

const now = Date.now()
const relevant = rows
  .filter(match)
  .filter((r) => !filter ? new Date(r.utc_kickoff).getTime() > now - 36 * 3600_000 : true)
  .sort((a, b) => new Date(a.utc_kickoff) - new Date(b.utc_kickoff))

if (relevant.length === 0) {
  console.log('No matches found for that filter.')
  process.exit(0)
}

console.log('=== What the API returns RIGHT NOW ===')
for (const r of relevant) {
  const score = r.home_score == null ? '—' : `${r.home_score}-${r.away_score}`
  console.log(
    `  [${r.id}] ${r.utc_kickoff}  ${r.home_team} vs ${r.away_team}  status=${r.status}  score=${score}`
  )
}

// If we also have DB access, compare cached scores and audit already-scored predictions.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) {
  console.log(
    '\n(No SUPABASE_SERVICE_ROLE_KEY in .env.local — skipping the database comparison. ' +
      'Add it to also see cached scores and mis-scored predictions.)'
  )
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, svc, { auth: { persistSession: false } })

const ids = relevant.map((r) => r.id)
const { data: cached, error: cErr } = await db
  .from('ucl_matches')
  .select('id, home_team, away_team, status, home_score, away_score')
  .in('id', ids)
if (cErr) throw cErr

const apiById = new Map(relevant.map((r) => [r.id, r]))

console.log('\n=== Cached row (what the APP shows) vs API, and mis-scored predictions ===')
for (const c of cached ?? []) {
  const a = apiById.get(c.id)
  const cachedScore = c.home_score == null ? '—' : `${c.home_score}-${c.away_score}`
  const apiScore = a.home_score == null ? '—' : `${a.home_score}-${a.away_score}`
  const drift = cachedScore !== apiScore ? '   <-- DB DIFFERS FROM API' : ''
  console.log(`\n  [${c.id}] ${c.home_team} vs ${c.away_team}`)
  console.log(`     app shows: ${cachedScore} (${c.status})   api now: ${apiScore} (${a.status})${drift}`)

  if (a.home_score == null) continue

  const { data: preds, error: pErr } = await db
    .from('ucl_predictions')
    .select('id, user_id, home_goals, away_goals, points')
    .eq('match_id', c.id)
  if (pErr) throw pErr

  let wrong = 0
  for (const p of preds ?? []) {
    const correct = pointsFor(a.home_score, a.away_score, p.home_goals, p.away_goals)
    if (p.points !== null && p.points !== correct) {
      wrong++
      console.log(
        `        prediction ${p.id}: predicted ${p.home_goals}-${p.away_goals}  ` +
          `stored ${p.points} pts  should be ${correct} pts`
      )
    }
  }
  console.log(
    wrong > 0
      ? `     ==> ${wrong} prediction(s) have WRONG points for this match`
      : `     ==> all stored points already match the current API score`
  )
}

console.log('\nDone. Nothing was modified.')
