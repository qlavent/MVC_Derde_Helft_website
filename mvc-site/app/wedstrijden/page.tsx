'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'
import MatchCard from '@/components/MatchCard'
import { RefreshCw, ChevronDown } from 'lucide-react'

function getSeason(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth() // 0-indexed
  // Season starts in August/September: Aug-Dec = year/year+1, Jan-Jul = year-1/year
  const startYear = month >= 7 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

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

    let matches: Match[] = []
    if (data && data.length > 0) {
      matches = data
    } else {
      try {
        const res = await fetch('/api/rbfa-matches')
        const rbfaData = await res.json()
        matches = Array.isArray(rbfaData) ? rbfaData : []
      } catch {
        matches = []
      }
    }

    setAllMatches(matches)

    // Compute seasons
    const seasonSet = new Set(matches.map((m) => getSeason(m.start_time)))
    const sortedSeasons = Array.from(seasonSet).sort().reverse()
    setSeasons(sortedSeasons)

    // Default to current season
    const now = new Date()
    const currentSeason = getSeason(now.toISOString())
    const activeSeason = sortedSeasons.includes(currentSeason) ? currentSeason : sortedSeasons[0]
    setSelectedSeason(activeSeason)

    // Find next upcoming match
    const next = matches.find((m) => m.state === 'upcoming' || m.state === 'live')
    setNextMatchId(next?.id ?? null)

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
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Wedstrijden</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncRbfa}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-[var(--sand)] border border-[var(--sand)]/30 rounded-full px-3 py-1.5 active:opacity-70 disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync RBFA'}
          </button>
          <Link href="/rankings" className="flex items-center gap-1 text-xs text-[var(--subtle)] border border-[var(--border)] rounded-full px-3 py-1.5">
            🏆 Standen
          </Link>
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
      <div className="px-4 space-y-3 pb-6">
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
