'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUclSession } from '@/lib/ucl/session'
import AuthGate from '@/components/ucl/AuthGate'
import MatchdaySection from '@/components/ucl/predict/MatchdaySection'
import type { UclMatch, UclPrediction } from '@/components/ucl/predict/PredictionRow'
import { isOpen } from '@/lib/ucl/score.mjs'
import { matchdayLabel } from '@/lib/ucl/labels.mjs'
import { currentMatchday } from '@/lib/ucl/api.mjs'

/** Statuses that make a matchday still worth showing on this screen. */
const LIVE_STATUSES = ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED']

export default function VoorspellingenPage() {
  return (
    <AuthGate>
      <Wedstrijden />
    </AuthGate>
  )
}

/**
 * Wedstrijden — the prediction screen (decisions 3, 5, 12, 13).
 *
 * One read of ucl_matches rather than a filtered one: a Champions League season is under 200
 * rows, and the grouping needs the finished matches of a half-played matchday anyway (a
 * matchday must read completely, not as the leftovers). currentMatchday() then works off the
 * same array, with no second query.
 *
 * Everything here goes through RLS with the anon key: nothing is readable without a session,
 * and the writes in PredictionRow are constrained to your own rows before kickoff.
 */
function Wedstrijden() {
  const { session } = useUclSession()
  const userId = session?.user?.id ?? null

  const [matches, setMatches] = useState<UclMatch[]>([])
  const [predictions, setPredictions] = useState<UclPrediction[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const [matchRes, predictionRes, playerRes] = await Promise.all([
        supabase.from('ucl_matches').select('*').order('utc_kickoff', { ascending: true }),
        supabase
          .from('ucl_predictions')
          .select('user_id, match_id, home_goals, away_goals, points'),
        supabase.from('ucl_players').select('user_id, display_name'),
      ])
      if (!alive) return

      const failure = matchRes.error ?? predictionRes.error ?? playerRes.error
      if (failure) {
        setError(`Laden lukte niet: ${failure.message}`)
        setLoading(false)
        return
      }

      const rows = (matchRes.data ?? []) as UclMatch[]
      setMatches(rows)
      setPredictions((predictionRes.data ?? []) as UclPrediction[])
      setNames(
        new Map((playerRes.data ?? []).map((p) => [p.user_id, p.display_name] as const))
      )

      // Decision 5: currentMatchday() decides only which section starts expanded.
      const current = currentMatchday(rows)
      setOpenKeys(new Set([groupKey(current.stage, current.matchday)]))
      setLoading(false)
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  // Keep the screen live while it matters. A match being played, or one that has just finished
  // but whose predictions the sync has not scored yet, is the only time ucl_matches changes on
  // its own — so that is the only time we poll. On every other day this effect does nothing.
  const shouldPoll = useMemo(() => {
    if (matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return true
    const finishedIds = new Set(
      matches.filter((m) => m.status === 'FINISHED').map((m) => m.id)
    )
    return predictions.some((p) => p.points == null && finishedIds.has(p.match_id))
  }, [matches, predictions])

  // Refresh scores and points without disturbing which matchdays are open (openKeys is left
  // untouched) or flashing the skeleton (loading stays false). Because shouldPoll is a boolean,
  // a poll that changes the data but not the liveness leaves this interval running as-is.
  useEffect(() => {
    if (!shouldPoll) return
    let alive = true
    const tick = async () => {
      const [matchRes, predictionRes] = await Promise.all([
        supabase.from('ucl_matches').select('*').order('utc_kickoff', { ascending: true }),
        supabase.from('ucl_predictions').select('user_id, match_id, home_goals, away_goals, points'),
      ])
      if (!alive) return
      if (!matchRes.error) setMatches((matchRes.data ?? []) as UclMatch[])
      if (!predictionRes.error) setPredictions((predictionRes.data ?? []) as UclPrediction[])
    }
    const id = setInterval(() => void tick(), 30_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [shouldPoll])

  // Matchdays that still have something unplayed. Finished matches inside such a matchday are
  // kept, so a half-played matchday shows all of its matches instead of a gappy list.
  const groups = useMemo(() => {
    const liveKeys = new Set(
      matches.filter((m) => LIVE_STATUSES.includes(m.status)).map((m) => groupKey(m.stage, m.matchday))
    )
    const byKey = new Map<string, { key: string; label: string; matches: UclMatch[] }>()
    for (const m of matches) {
      const key = groupKey(m.stage, m.matchday)
      if (!liveKeys.has(key)) continue
      // Typed explicitly: matchdayLabel comes from an untyped .mjs, so without this the
      // literal's `matches: []` infers never[] and the push below fails to compile.
      const group: { key: string; label: string; matches: UclMatch[] } =
        byKey.get(key) ?? {
          key,
          label: matchdayLabel(m.stage, m.matchday) as string,
          matches: [],
        }
      group.matches.push(m)
      byKey.set(key, group)
    }
    // `matches` arrives kickoff-ordered, so both the groups and the matches inside them are
    // already in the right order — the first match of a group is its earliest kickoff.
    return Array.from(byKey.values())
  }, [matches])

  const missing = useMemo(() => {
    if (!userId) return 0
    const mine = new Set(
      predictions.filter((p) => p.user_id === userId).map((p) => p.match_id)
    )
    return matches.filter((m) => isOpen(m) && !mine.has(m.id)).length
  }, [matches, predictions, userId])

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="px-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ucl-card h-28 animate-pulse opacity-60" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4">
        <div className="ucl-card p-5">
          <h2 className="text-base font-bold mb-1">Er ging iets mis</h2>
          <p className="text-sm text-red-400 leading-relaxed">{error}</p>
          <p className="text-sm text-[var(--subtle)] leading-relaxed mt-2">
            Probeer de pagina opnieuw te laden.
          </p>
        </div>
      </div>
    )
  }

  // Not an error: until the fixtures are synced for the first time, ucl_matches is simply empty.
  if (groups.length === 0) {
    return (
      <div className="px-4">
        <div className="ucl-card p-5">
          <h2 className="text-base font-bold mb-1">Nog geen wedstrijden</h2>
          <p className="text-sm text-[var(--subtle)] leading-relaxed">
            De speelkalender staat er nog niet in. Zodra de wedstrijden zijn ingeladen,
            verschijnen ze hier en kan je voorspellen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4">
      {/* Decision 13: the reminder is a count, here and as a badge on the dock. */}
      {missing > 0 && (
        <p className="text-sm text-[var(--sand)] font-semibold mb-3">
          {missing === 1
            ? '1 wedstrijd zonder voorspelling'
            : `${missing} wedstrijden zonder voorspelling`}
        </p>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const ids = new Set(g.matches.map((m) => m.id))
          return (
            <MatchdaySection
              key={g.key}
              label={g.label}
              matches={g.matches}
              predictions={predictions.filter((p) => ids.has(p.match_id))}
              names={names}
              userId={userId ?? ''}
              open={openKeys?.has(g.key) ?? false}
              onToggle={() => toggle(g.key)}
            />
          )
        })}
      </div>
    </div>
  )
}

function groupKey(stage: string | null, matchday: number | null): string {
  return `${stage ?? ''}|${matchday ?? ''}`
}
