'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatBrussels } from '@/lib/utils'
import { matchdayLabel } from '@/lib/ucl/labels.mjs'
import { useUclSession, signOut } from '@/lib/ucl/session'
import AuthGate from '@/components/ucl/AuthGate'

/**
 * Mij (spec decision 2): your own history, your name, sign out.
 *
 * Only the display name is ever shown — never the email address the magic link was sent to.
 * That is the same rule the naam screen follows.
 */
export default function MijPage() {
  return (
    <AuthGate>
      <Mij />
    </AuthGate>
  )
}

// ── Shapes ───────────────────────────────────────────────────────────────────
// No generated Database types in this project, so the embed comes back untyped and is cast
// once, here, rather than being spread as `any` through the render.

type UclMatchRow = {
  id: number
  season: string | null
  stage: string | null
  matchday: number | null
  utc_kickoff: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
}

type PredictionRow = {
  id: string
  home_goals: number
  away_goals: number
  points: number | null
  ucl_matches: UclMatchRow | null
}

type Group = { key: string; label: string; season: string | null; rows: PredictionRow[] }

// One shared implementation, so a round is named identically here, on Wedstrijden and on
// Resultaten. Three local copies had already drifted apart.
function groupLabel(m: UclMatchRow): string {
  return matchdayLabel(m.stage, m.matchday)
}

// ── Screen ───────────────────────────────────────────────────────────────────

function Mij() {
  const router = useRouter()
  const { user, player } = useUclSession()
  const [rows, setRows] = useState<PredictionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const userId = user?.id ?? null

  const load = useCallback(async () => {
    if (!userId) return
    // ponytail: one query, no status filter in SQL. The header needs every prediction (the
    // count includes matches that have not kicked off yet) and the history needs only the
    // finished ones, so fetching once and splitting in JS keeps the two numbers from ever
    // disagreeing with the list underneath them. A player's whole season is ~150 rows.
    const { data, error } = await supabase
      .from('ucl_predictions')
      .select(
        'id, home_goals, away_goals, points, ' +
          'ucl_matches(id, season, stage, matchday, utc_kickoff, home_team, away_team, home_score, away_score, status)'
      )
      .eq('user_id', userId)
    if (error) {
      setError(`Je geschiedenis laden lukte niet: ${error.message}`)
      setRows([])
      return
    }
    setError(null)
    setRows((data ?? []) as unknown as PredictionRow[])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace('/voorspellingen/login')
  }

  if (rows === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--sand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // points is null until the sync scores it, so summing skips unscored rows without counting
  // them as zero. Every season is in here: this is the all-time total, not the current one.
  const totalPoints = rows.reduce((sum, r) => sum + (r.points ?? 0), 0)

  const finished = rows
    .filter((r) => r.ucl_matches?.status === 'FINISHED')
    .sort(
      (a, b) =>
        new Date(b.ucl_matches!.utc_kickoff).getTime() -
        new Date(a.ucl_matches!.utc_kickoff).getTime()
    )

  // Newest first, and the groups follow that order because each one is created the first time
  // its newest match is met. Season is part of the key: "Speeldag 3" happens every year.
  const groups: Group[] = []
  const byKey = new Map<string, Group>()
  for (const row of finished) {
    const m = row.ucl_matches!
    const key = `${m.season ?? '?'}|${m.stage ?? '?'}|${m.matchday ?? '?'}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, label: groupLabel(m), season: m.season, rows: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
  }

  // Only worth naming the season once there is more than one to tell apart.
  const multiSeason = new Set(rows.map((r) => r.ucl_matches?.season ?? '?')).size > 1

  return (
    <div className="px-4 space-y-4">
      {/* ── Wie je bent ───────────────────────────────────────────────────── */}
      <section className="ucl-card p-5">
        <p className="text-xs text-[var(--subtle)] mb-1">Jouw profiel</p>
        <h2 className="text-2xl font-black leading-tight break-words">{player?.display_name}</h2>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--muted)] px-4 py-3">
            <p className="text-2xl font-black tabular leading-none text-[var(--sand)]">
              {totalPoints}
            </p>
            <p className="text-xs text-[var(--subtle)] mt-1">
              {totalPoints === 1 ? 'punt' : 'punten'} totaal
            </p>
          </div>
          <div className="rounded-xl bg-[var(--muted)] px-4 py-3">
            <p className="text-2xl font-black tabular leading-none">{rows.length}</p>
            <p className="text-xs text-[var(--subtle)] mt-1">
              {rows.length === 1 ? 'voorspelling' : 'voorspellingen'}
            </p>
          </div>
        </div>

        <Link
          href="/voorspellingen/naam"
          className="mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-[var(--sand)] py-2"
        >
          Naam wijzigen
          <ChevronRight size={16} />
        </Link>
      </section>

      {/* ── Geschiedenis ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="ucl-rule text-sm font-bold mb-3">Jouw geschiedenis</h3>

        {error && <p className="text-sm text-red-400 leading-relaxed mb-3">{error}</p>}

        {finished.length === 0 ? (
          <EmptyHistory pending={rows.length} />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-baseline justify-between gap-2 mb-2 px-1">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--subtle)] break-words">
                    {group.label}
                  </h4>
                  {multiSeason && group.season && (
                    <span className="text-xs text-[var(--subtle2)] shrink-0 tabular">
                      {group.season}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <HistoryRow key={row.id} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Uitloggen ─────────────────────────────────────────────────────────
          Quiet on purpose: signing out costs nothing but another magic link. */}
      <section className="pt-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[var(--subtle)] border border-[var(--border)] disabled:opacity-40"
        >
          <LogOut size={15} />
          {signingOut ? 'Uitloggen…' : 'Uitloggen'}
        </button>
        <p className="text-xs text-[var(--subtle2)] leading-relaxed text-center mt-2">
          Je voorspellingen blijven bewaard. Terugkomen doe je met een nieuwe inloglink.
        </p>
      </section>
    </div>
  )
}

// ── Parts ────────────────────────────────────────────────────────────────────

/**
 * A brand new player lands here with nothing, which is the normal first experience — the
 * migration has not even run yet. It should read as an invitation, not as a failure.
 */
function EmptyHistory({ pending }: { pending: number }) {
  return (
    <div className="ucl-card p-5">
      <p className="text-sm font-bold mb-1">
        {pending > 0 ? 'Nog niets gespeeld' : 'Hier komt jouw geschiedenis'}
      </p>
      <p className="text-sm text-[var(--subtle)] leading-relaxed">
        {pending > 0
          ? `Je hebt ${pending} ${pending === 1 ? 'voorspelling' : 'voorspellingen'} klaarstaan. Zodra die wedstrijden gespeeld zijn, verschijnen ze hier met je punten erbij.`
          : 'Zodra je je eerste wedstrijd voorspeld hebt en die gespeeld is, zie je hier de uitslag, jouw tip en wat het opleverde.'}
      </p>
      <Link
        href="/voorspellingen"
        className="mt-4 flex items-center justify-center gap-1 w-full rounded-xl py-3 font-bold bg-[var(--sand)] text-[var(--sand-fg)]"
      >
        Naar de wedstrijden
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

function HistoryRow({ row }: { row: PredictionRow }) {
  const m = row.ucl_matches!
  return (
    <article className="ucl-card p-4">
      <div className="flex items-start gap-3">
        {/* Scoreboard: names wrap onto as many lines as they need, the real score stays
            pinned to the right of them. */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-bold leading-snug break-words">{m.home_team}</p>
          <p className="text-sm font-bold leading-snug break-words">{m.away_team}</p>
        </div>
        <div className="shrink-0 text-right tabular space-y-0.5">
          <p className="text-sm font-bold leading-snug">{m.home_score ?? '–'}</p>
          <p className="text-sm font-bold leading-snug">{m.away_score ?? '–'}</p>
        </div>
        <PointsBadge points={row.points} />
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3 text-xs">
        <span className="text-[var(--subtle)]">
          Jouw voorspelling:{' '}
          <span className="text-[var(--fg)] font-bold tabular">
            {row.home_goals}–{row.away_goals}
          </span>
        </span>
        <span className="text-[var(--subtle2)] shrink-0 tabular">
          {formatBrussels(m.utc_kickoff, 'd MMM yyyy')}
        </span>
      </div>
    </article>
  )
}

/**
 * The scoring table is 10 / 7 / 5 / 1 (spec), so the badge escalates with it: a full-accent
 * block for a perfect score, a tint for the near misses, plain grey for the consolation point.
 * You should be able to scroll the list and see where the tens are without reading a number.
 *
 * null is not zero. An unscored prediction says so in words — the migration is explicit that
 * the Discord bot's habit of storing 1 made "not yet scored" and "scored 1" indistinguishable.
 */
function PointsBadge({ points }: { points: number | null }) {
  if (points === null) {
    return (
      <span className="shrink-0 self-center rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-[var(--subtle)] bg-[var(--muted)] max-w-[6.5rem] text-center leading-tight">
        nog niet gescoord
      </span>
    )
  }

  const tone =
    points >= 10
      ? 'bg-[var(--sand)] text-[var(--sand-fg)] px-3 py-2'
      : points >= 7
        ? 'bg-sand-20 border border-sand-50 text-[var(--fg)] px-3 py-2'
        : points >= 5
          ? 'bg-sand-10 border border-sand-30 text-[var(--fg)] px-2.5 py-1.5'
          : 'bg-[var(--muted)] text-[var(--subtle)] px-2.5 py-1.5'

  const size = points >= 10 ? 'text-2xl' : points >= 7 ? 'text-xl' : 'text-base'

  return (
    <span
      className={`shrink-0 self-center rounded-xl flex items-baseline gap-1 whitespace-nowrap ${tone}`}
    >
      <span className={`font-black tabular leading-none ${size}`}>{points}</span>
      <span className="text-[10px] font-semibold opacity-70">{points === 1 ? 'punt' : 'ptn'}</span>
    </span>
  )
}
