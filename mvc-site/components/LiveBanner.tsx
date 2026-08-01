'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'
import { scoreFor, type GoalRow, type CornerRow } from '@/lib/score'
import Link from 'next/link'

export default function LiveBanner() {
  const [match, setMatch] = useState<Match | null>(null)
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [corners, setCorners] = useState<CornerRow[]>([])

  async function fetchLive() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('state', 'live')
      .limit(1)
      .maybeSingle()
    setMatch(data)
    if (data) {
      // A live match has no official result yet, so the score comes from the manual tally.
      const [{ data: goalRows }, { data: cornerRows }] = await Promise.all([
        supabase.from('goals').select('match_id, player_id, is_corner_goal').eq('match_id', data.id),
        supabase.from('corners').select('match_id, is_goal').eq('match_id', data.id),
      ])
      setGoals(goalRows ?? [])
      setCorners(cornerRows ?? [])
    }
  }

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!match) return null

  const score = scoreFor(match, goals, corners)

  return (
    <div className="mx-4 mb-[var(--v-gap)]">
      <Link href={`/wedstrijden/${match.id}`}>
        <div className="rounded-2xl p-[var(--v-pad)] border border-red-500/40" style={{ background: 'linear-gradient(135deg, rgba(127,0,0,0.3), var(--surface))' }}>
          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-[var(--v-gap)]">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-bold uppercase tracking-widest">Live</span>
            <span className="text-xs text-red-400/60 ml-auto">{match.series_name}</span>
          </div>

          {/* Score */}
          <div className="flex items-start justify-between gap-3">
            <span className={`text-sm font-bold flex-1 min-w-0 break-words leading-tight ${match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
              {match.home_team_name}
            </span>

            <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2 flex-shrink-0">
              <span className="text-2xl font-black tabular-nums text-white">
                {score?.home ?? 0}
              </span>
              <span className="text-white/40 font-bold">—</span>
              <span className="text-2xl font-black tabular-nums text-white">
                {score?.away ?? 0}
              </span>
            </div>

            <span className={`text-sm font-bold flex-1 min-w-0 text-right break-words leading-tight ${!match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
              {match.away_team_name}
            </span>
          </div>

          {score?.disagrees && (
            <p className="text-[11px] text-red-400/70 text-center mt-2">
              Officieel {score.home}–{score.away} · geteld {score.disagrees.home}–{score.disagrees.away}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
