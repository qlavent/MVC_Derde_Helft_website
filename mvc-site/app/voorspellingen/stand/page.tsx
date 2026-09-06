'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUclSession } from '@/lib/ucl/session'
import AuthGate from '@/components/ucl/AuthGate'
import LeaderboardTable, { type LeaderboardRow } from '@/components/ucl/results/LeaderboardTable'

/**
 * One row of ucl_leaderboard. The view is grouped per (season, user_id), which is what makes
 * decision 7 cheap: ONE query feeds both tabs, so the season tab and the all-time tab are
 * literally the same numbers added up differently and can never disagree.
 *
 * `predictions`, `scored` and `exact_hits` are on the view too but deliberately not selected —
 * decision 8 is points only.
 */
type ViewRow = {
  season: string | null
  user_id: string
  display_name: string
  points: number
}

/** ucl_matches.season is nullable, so the view's season can be null. Give it a home. */
const NO_SEASON = '__geen__'
const seasonKey = (s: string | null) => s ?? NO_SEASON
const seasonLabel = (k: string) => (k === NO_SEASON ? 'Onbekend seizoen' : `Seizoen ${k}`)

type Tab = 'seizoen' | 'altijd'

type Player = { user_id: string; display_name: string }

function Stand() {
  const { user } = useUclSession()
  const [rows, setRows] = useState<ViewRow[] | null>(null)
  // Every registered player, so the standings can list someone who has not predicted yet.
  // ucl_leaderboard is built from ucl_predictions, so a new player simply does not appear in
  // it — they would look at the standings and find no trace of themselves.
  const [players, setPlayers] = useState<Player[]>([])
  // Seasons come from the fixtures, not from the view: before anyone predicts, the view is
  // empty and the dropdown would have nothing in it even though a season is clearly running.
  const [matchSeasons, setMatchSeasons] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('seizoen')
  const [season, setSeason] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('ucl_leaderboard').select('season, user_id, display_name, points'),
      supabase.from('ucl_players').select('user_id, display_name'),
      supabase.from('ucl_matches').select('season'),
    ]).then(([board, people, matches]) => {
      if (!alive) return
      if (board.error) {
        setError(board.error.message)
        setRows([])
        return
      }
      const list = (board.data ?? []) as ViewRow[]
      setRows(list)
      setPlayers((people.data ?? []) as Player[])

      const fromMatches = Array.from(
        new Set(((matches.data ?? []) as { season: string | null }[]).map(m => seasonKey(m.season)))
      )
      setMatchSeasons(fromMatches)

      // Default to the most recent season present. Labels are "2026-2027", so a plain
      // string sort is chronological.
      const keys = Array.from(
        new Set([...list.map(r => seasonKey(r.season)), ...fromMatches])
      ).sort().reverse()
      setSeason(keys[0] ?? null)
    })
    return () => {
      alive = false
    }
  }, [])

  const seasons = useMemo(
    () =>
      Array.from(
        new Set([...(rows ?? []).map(r => seasonKey(r.season)), ...matchSeasons])
      ).sort().reverse(),
    [rows, matchSeasons]
  )

  /** Everyone at zero, so a player who has not scored still has a row to stand in. */
  const baseline = useMemo(
    () => players.map(p => ({ user_id: p.user_id, display_name: p.display_name, points: 0 })),
    [players]
  )

  const seasonRows = useMemo<LeaderboardRow[]>(() => {
    const totals = new Map<string, LeaderboardRow>(baseline.map(r => [r.user_id, { ...r }]))
    for (const r of rows ?? []) {
      if (seasonKey(r.season) !== season) continue
      totals.set(r.user_id, {
        user_id: r.user_id,
        display_name: r.display_name,
        points: r.points,
      })
    }
    return Array.from(totals.values()).sort(byPoints)
  }, [rows, season, baseline])

  // All-time: fold the same rows over every season. display_name is identical across a user's
  // rows (the view joins ucl_players), so last one wins is safe.
  const allTimeRows = useMemo<LeaderboardRow[]>(() => {
    const totals = new Map<string, LeaderboardRow>(baseline.map(r => [r.user_id, { ...r }]))
    for (const r of rows ?? []) {
      const prev = totals.get(r.user_id)
      totals.set(r.user_id, {
        user_id: r.user_id,
        display_name: r.display_name,
        points: (prev?.points ?? 0) + r.points,
      })
    }
    return Array.from(totals.values()).sort(byPoints)
  }, [rows, baseline])

  if (rows === null) {
    return (
      <div className="px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ucl-card h-12 mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 pb-28">
      <div className="flex gap-1 mb-4">
        {(
          [
            ['seizoen', 'Seizoen'],
            ['altijd', 'Aller tijden'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === key ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--surface)] text-[var(--subtle)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'seizoen' && seasons.length > 0 && (
        <div className="mb-4">
          <div className="relative inline-block">
            <select
              value={season ?? ''}
              onChange={e => setSeason(e.target.value)}
              className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer"
            >
              {seasons.map(k => (
                <option key={k} value={k}>
                  {seasonLabel(k)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="ucl-card p-4 mb-3 text-sm text-red-400 break-words">
          Stand kon niet geladen worden: {error}
        </p>
      )}

      <LeaderboardTable
        rows={tab === 'seizoen' ? seasonRows : allTimeRows}
        currentUserId={user?.id ?? null}
        emptyText={
          error
            ? 'Geen stand beschikbaar.'
            : tab === 'seizoen'
              ? 'Nog geen punten dit seizoen. De stand vult zich na de eerste speeldag.'
              : 'Nog geen punten gespeeld. De stand vult zich na de eerste speeldag.'
        }
      />
    </div>
  )
}

/** Most points first, then alphabetically so the order is stable between renders. */
function byPoints(a: LeaderboardRow, b: LeaderboardRow) {
  return b.points - a.points || a.display_name.localeCompare(b.display_name, 'nl')
}

export default function StandPage() {
  return (
    <AuthGate>
      <Stand />
    </AuthGate>
  )
}
