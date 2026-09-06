'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUclSession } from '@/lib/ucl/session'
import AuthGate from '@/components/ucl/AuthGate'
import { matchdayLabel } from '@/lib/ucl/labels.mjs'
import MatchResultCard, {
  type ResultMatch,
  type ResultPrediction,
} from '@/components/ucl/results/MatchResultCard'

type Row = ResultMatch & {
  season: string | null
  stage: string | null
  matchday: number | null
}

/**
 * Dutch names for football-data.org's CL stage codes. Both the v4 names and the older ones
 * are listed, because ucl_matches keeps whatever the API said at sync time and a season played
 * under the old format must not suddenly render as a raw enum.
 */

// One shared implementation, so a round is named identically here, on Wedstrijden and on
// Mij. Three local copies had already drifted apart.
function groupLabel(r: Row): string {
  return matchdayLabel(r.stage, r.matchday)
}

const groupKey = (r: Row) => `${r.season ?? ''}|${r.stage ?? ''}|${r.matchday ?? ''}`

type Group = { key: string; label: string; season: string | null; matches: ResultMatch[]; last: number }

function Resultaten() {
  const { user } = useUclSession()
  const [matches, setMatches] = useState<Row[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [preds, setPreds] = useState<ResultPrediction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Finished matches and the name table. Both are small and change rarely, so they load once.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [m, p] = await Promise.all([
        supabase
          .from('ucl_matches')
          .select(
            'id, season, stage, matchday, utc_kickoff, home_team, away_team, home_crest, away_crest, home_score, away_score'
          )
          .eq('status', 'FINISHED')
          .order('utc_kickoff', { ascending: false }),
        supabase.from('ucl_players').select('user_id, display_name'),
      ])
      if (!alive) return
      if (m.error) {
        setError(m.error.message)
        setMatches([])
        return
      }
      setMatches((m.data ?? []) as Row[])
      setNames(
        Object.fromEntries(
          ((p.data ?? []) as { user_id: string; display_name: string }[]).map(x => [
            x.user_id,
            x.display_name,
          ])
        )
      )
    })()
    return () => {
      alive = false
    }
  }, [])

  // Newest matchday first, by the latest kickoff it contains.
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>()
    for (const r of matches ?? []) {
      const key = groupKey(r)
      const at = new Date(r.utc_kickoff).getTime()
      const g = byKey.get(key)
      if (g) {
        g.matches.push(r)
        g.last = Math.max(g.last, at)
      } else {
        byKey.set(key, { key, label: groupLabel(r), season: r.season, matches: [r], last: at })
      }
    }
    const list = Array.from(byKey.values()).sort((a, b) => b.last - a.last)
    for (const g of list) {
      g.matches.sort((a, b) => +new Date(a.utc_kickoff) - +new Date(b.utc_kickoff))
    }
    return list
  }, [matches])

  useEffect(() => {
    if (selected === null && groups.length > 0) setSelected(groups[0].key)
  }, [groups, selected])

  const group = groups.find(g => g.key === selected) ?? null

  // Predictions only for the matchday on screen — a whole season of finished matches would put
  // a couple of hundred ids in the `in(...)` query string.
  useEffect(() => {
    if (!group) return
    let alive = true
    setPreds(null)
    supabase
      .from('ucl_predictions')
      .select('user_id, match_id, home_goals, away_goals, points')
      .in(
        'match_id',
        group.matches.map(m => m.id)
      )
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError(error.message)
        setPreds((data ?? []) as ResultPrediction[])
      })
    return () => {
      alive = false
    }
  }, [group])

  // Points per player for this matchday. An unscored prediction adds nothing rather than a
  // zero — the strip is a total, and a missing total is honest until the sync has run.
  const totals = useMemo(() => {
    const sums = new Map<string, number>()
    for (const p of preds ?? []) sums.set(p.user_id, (sums.get(p.user_id) ?? 0) + (p.points ?? 0))
    return Array.from(sums, ([user_id, points]) => ({ user_id, points })).sort(
      (a, b) => b.points - a.points
    )
  }, [preds])

  if (matches === null) {
    return (
      <div className="px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ucl-card h-24 mb-3 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 pb-28">
      {error && (
        <p className="ucl-card p-4 mb-3 text-sm text-red-400 break-words">
          Resultaten konden niet geladen worden: {error}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="ucl-card p-6 text-center">
          <p className="text-sm text-[var(--subtle)]">
            Nog geen gespeelde wedstrijden. Zodra de eerste speeldag afgelopen is, staan de
            resultaten hier.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="relative inline-block">
              <select
                value={selected ?? ''}
                onChange={e => setSelected(e.target.value)}
                className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer"
              >
                {groups.map(g => (
                  <option key={g.key} value={g.key}>
                    {g.season ? `${g.label} · ${g.season}` : g.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none"
              />
            </div>
          </div>

          <h2 className="ucl-rule text-sm font-bold mb-2">Punten deze speeldag</h2>
          <div className="ucl-card p-3 mb-5">
            {preds === null ? (
              <div className="h-6 animate-pulse rounded bg-[var(--muted)]" />
            ) : totals.length === 0 ? (
              <p className="text-xs text-[var(--subtle)]">
                Niemand heeft deze speeldag voorspeld.
              </p>
            ) : (
              totals.map(t => (
                <div
                  key={t.user_id}
                  className={`flex items-center gap-2 py-1 ${t.user_id === user?.id ? 'font-bold text-[var(--sand)]' : ''}`}
                >
                  <span className="flex-1 min-w-0 text-sm break-words leading-tight">
                    {names[t.user_id] || 'Onbekend'}
                  </span>
                  <span className="text-sm font-black tabular whitespace-nowrap">{t.points}</span>
                </div>
              ))
            )}
          </div>

          <h2 className="ucl-rule text-sm font-bold mb-2">Wedstrijden</h2>
          {group?.matches.map(m => (
            <MatchResultCard
              key={m.id}
              match={m}
              predictions={(preds ?? []).filter(p => p.match_id === m.id)}
              names={names}
              currentUserId={user?.id ?? null}
            />
          ))}
        </>
      )}
    </div>
  )
}

export default function ResultatenPage() {
  return (
    <AuthGate>
      <Resultaten />
    </AuthGate>
  )
}
