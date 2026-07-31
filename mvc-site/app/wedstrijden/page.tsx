'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { seasonOf as getSeason } from '@/lib/utils'
import type { Match } from '@/lib/types'
import MatchCard from '@/components/MatchCard'
import { RefreshCw, ChevronDown } from 'lucide-react'

export default function WedstrijdenPage() {
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [seasons, setSeasons] = useState<string[]>([])
  const nextMatchRef = useRef<HTMLDivElement>(null)
  const [nextMatchId, setNextMatchId] = useState<string | null>(null)

  useEffect(() => {
    fetchMatches()
  }, [])

  // Auto-scroll to next match after data loads
  useEffect(() => {
    if (nextMatchId && nextMatchRef.current) {
      setTimeout(() => {
        nextMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [nextMatchId, selectedSeason])

  async function fetchMatches() {
    setLoading(true)

    const { data } = await supabase.from('matches').select('*').order('start_time', { ascending: true })
    const matches: Match[] = data ?? []

    setAllMatches(matches)

    // Compute seasons
    const seasonSet = new Set(matches.map((m) => getSeason(m.start_time)))
    const sortedSeasons = Array.from(seasonSet).sort().reverse()
    setSeasons(sortedSeasons)

    // Find next upcoming match
    const next = matches.find((m) => m.state === 'upcoming' || m.state === 'live')
    setNextMatchId(next?.id ?? null)

    // Default to the season of the next match, so the summer break shows the new
    // fixture list instead of an empty tab. Falls back to the most recent season.
    const currentSeason = getSeason(new Date().toISOString())
    setSelectedSeason(
      next ? getSeason(next.start_time)
        : sortedSeasons.includes(currentSeason) ? currentSeason
        : sortedSeasons[0]
    )

    setLoading(false)
  }

  async function syncRbfa() {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      await fetchMatches()
    } finally {
      setSyncing(false)
    }
  }

  const seasonMatches = allMatches
    .filter((m) => getSeason(m.start_time) === selectedSeason)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Wedstrijden</h1>
        </div>
        {/* Stacked, and equal width so the pills line up. Standen is the primary action
            here (it goes somewhere), so it gets the solid treatment; Sync stays secondary. */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Link
            href="/rankings"
            className="flex items-center justify-center gap-1 min-w-[112px] text-xs font-semibold bg-[var(--sand)] text-[var(--sand-fg)] rounded-full px-3 py-1.5 active:opacity-80"
          >
            🏆 Standen
          </Link>
          <button
            onClick={syncRbfa}
            disabled={syncing}
            className="flex items-center justify-center gap-1.5 min-w-[112px] text-xs text-[var(--sand)] border border-sand-50 rounded-full px-3 py-1.5 active:opacity-70 disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync RBFA'}
          </button>
        </div>
      </div>

      {/* Season selector */}
      {seasons.length > 0 && (
        <div className="px-4 mb-4">
          <div className="relative inline-block">
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>Seizoen {s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none" />
          </div>
          <span className="ml-3 text-xs text-[var(--subtle)]">{seasonMatches.length} wedstrijden</span>
        </div>
      )}

      {/* Match list */}
      <div className="px-4 space-y-3 pb-28">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface)] rounded-2xl h-24 animate-pulse" />
          ))
        ) : seasonMatches.length === 0 ? (
          <div className="text-center text-[var(--subtle2)] py-12">
            <p className="text-3xl mb-2">⚽</p>
            <p>Geen wedstrijden gevonden</p>
          </div>
        ) : (
          seasonMatches.map((m) => {
            const isNext = m.id === nextMatchId
            return (
              <div key={m.id} ref={isNext ? nextMatchRef : undefined}>
                <MatchCard match={m} isNext={isNext} />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
