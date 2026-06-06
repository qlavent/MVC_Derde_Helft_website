'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'
import Link from 'next/link'

export default function LiveBanner() {
  const [match, setMatch] = useState<Match | null>(null)

  async function fetchLive() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('state', 'live')
      .limit(1)
      .maybeSingle()
    setMatch(data)
  }

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!match) return null

  const homeScore = match.manual_home_score ?? match.rbfa_home_score
  const awayScore = match.manual_away_score ?? match.rbfa_away_score

  return (
    <div className="mx-4 mb-4">
      <Link href={`/wedstrijden/${match.id}`}>
        <div className="rounded-2xl p-4 border border-red-500/40" style={{ background: 'linear-gradient(135deg, rgba(127,0,0,0.3), var(--surface))' }}>
          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-bold uppercase tracking-widest">Live</span>
            <span className="text-xs text-red-400/60 ml-auto">{match.series_name}</span>
          </div>

          {/* Score */}
          <div className="flex items-center justify-between gap-3">
            <span className={`text-sm font-bold flex-1 truncate ${match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
              {match.home_team_name}
            </span>

            <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2 flex-shrink-0">
              <span className="text-2xl font-black tabular-nums text-white">
                {homeScore ?? 0}
              </span>
              <span className="text-white/40 font-bold">—</span>
              <span className="text-2xl font-black tabular-nums text-white">
                {awayScore ?? 0}
              </span>
            </div>

            <span className={`text-sm font-bold flex-1 text-right truncate ${!match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
              {match.away_team_name}
            </span>
          </div>

          {match.rbfa_home_score !== null && (
            <p className="text-[10px] text-red-400/50 text-center mt-2">
              Officieel: {match.rbfa_home_score}–{match.rbfa_away_score}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
