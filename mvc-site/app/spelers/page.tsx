'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player, PlayerStats } from '@/lib/types'
import { ChevronDown, RefreshCw } from 'lucide-react'

function getSeason(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth()
  const startYear = month >= 7 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

function seasonDateRange(season: string): { from: string; to: string } {
  const startYear = parseInt(season.split('-')[0])
  return {
    from: `${startYear}-08-01T00:00:00`,
    to: `${startYear + 1}-07-31T23:59:59`,
  }
}

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  if (value === 0) return null
  return (
    <div className={`flex flex-col items-center bg-[var(--muted)] rounded-lg px-2 py-1.5 ${color}`}>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[9px] text-[var(--subtle)] leading-none mt-0.5">{label}</span>
    </div>
  )
}

export default function SpelersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadPlayers()
    loadSeasons()
  }, [])

  useEffect(() => {
    if (players.length > 0) computeStats()
  }, [players, selectedSeason])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').order('last_name')
    setPlayers(data ?? [])
  }

  async function loadSeasons() {
    const { data } = await supabase.from('matches').select('start_time')
    if (!data?.length) return
    const seasonSet = new Set(data.map((m) => getSeason(m.start_time)))
    const sorted = Array.from(seasonSet).sort().reverse()
    setSeasons(sorted)
    const now = new Date()
    const current = getSeason(now.toISOString())
    setSelectedSeason(sorted.includes(current) ? current : sorted[0] ?? 'all')
  }

  async function computeStats() {
    setLoading(true)

    let matchIds: string[] | null = null
    if (selectedSeason !== 'all') {
      const { from, to } = seasonDateRange(selectedSeason)
      const { data: seasonMatches } = await supabase
        .from('matches').select('id').gte('start_time', from).lte('start_time', to)
      matchIds = seasonMatches?.map((m) => m.id) ?? []
    }

    const applyFilter = (q: ReturnType<typeof supabase.from>, ids: string[] | null) =>
      ids ? q.in('match_id', ids) : q

    const [
      { data: goals },
      { data: cornersTaken },
      { data: cornersHeaded },
      { data: cards },
      { data: motms },
    ] = await Promise.all([
      applyFilter(supabase.from('goals').select('player_id, is_corner_goal, match_id'), matchIds),
      applyFilter(supabase.from('corners').select('taker_id, match_id'), matchIds),
      applyFilter(supabase.from('corners').select('header_id, match_id'), matchIds),
      applyFilter(supabase.from('cards').select('player_id, card_type, match_id'), matchIds),
      applyFilter(supabase.from('motm').select('player_id, match_id'), matchIds),
    ])

    const computed: PlayerStats[] = players.map((p) => ({
      player: p,
      goals: (goals ?? []).filter((g) => g.player_id === p.id).length,
      corner_goals: (goals ?? []).filter((g) => g.player_id === p.id && g.is_corner_goal).length,
      corners_taken: (cornersTaken ?? []).filter((c) => c.taker_id === p.id).length,
      corners_headed: (cornersHeaded ?? []).filter((c) => c.header_id === p.id).length,
      yellow_cards: (cards ?? []).filter((c) => c.player_id === p.id && c.card_type === 'yellow').length,
      red_cards: (cards ?? []).filter((c) => c.player_id === p.id && c.card_type === 'red').length,
      motm_count: (motms ?? []).filter((m) => m.player_id === p.id).length,
    }))

    setStats(computed.sort((a, b) => b.goals - a.goals || b.motm_count - a.motm_count))
    setLoading(false)
  }

  async function syncPlayers() {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      await loadPlayers()
      await loadSeasons()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Spelers</h1>
        </div>
        <button
          onClick={syncPlayers}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-[var(--sand)] border border-[var(--sand)]/30 rounded-full px-3 py-1.5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync RBFA'}
        </button>
      </div>

      {/* Season selector */}
      <div className="px-4 mb-4 flex items-center gap-3">
        <div className="relative inline-block">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer"
          >
            <option value="all">Alle seizoenen</option>
            {seasons.map((s) => (
              <option key={s} value={s}>Seizoen {s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none" />
        </div>
        <span className="text-xs text-[var(--subtle)]">{players.length} spelers</span>
      </div>

      <div className="px-4 space-y-3 pb-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface)] rounded-2xl h-20 animate-pulse" />
          ))
        ) : players.length === 0 ? (
          <div className="text-center text-[var(--subtle2)] py-12">
            <p className="text-3xl mb-2">👥</p>
            <p className="mb-3">Nog geen spelers geladen</p>
            <button onClick={syncPlayers} className="text-xs text-[var(--sand)] border border-[var(--sand)]/30 rounded-full px-4 py-2">
              Sync RBFA om spelers te laden
            </button>
          </div>
        ) : (
          stats.map((s) => {
            const hasStats = s.goals > 0 || s.corners_taken > 0 || s.corners_headed > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.motm_count > 0
            return (
              <div key={s.player.id} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[var(--sand)]">
                      {s.player.first_name[0]}{s.player.last_name[0]}
                    </span>
                  </div>
                  <p className="text-sm font-bold flex-1">{s.player.first_name} {s.player.last_name}</p>
                  {s.motm_count > 0 && (
                    <span className="text-xs text-yellow-400">⭐ {s.motm_count}×</span>
                  )}
                </div>
                {hasStats ? (
                  <div className="flex flex-wrap gap-2">
                    <StatBadge value={s.goals} label="goals" color="text-[var(--sand)]" />
                    <StatBadge value={s.corners_taken} label="corners" color="text-[var(--olive)]" />
                    <StatBadge value={s.corners_headed} label="koppen" color="text-[var(--olive)]" />
                    <StatBadge value={s.yellow_cards} label="geel" color="text-yellow-400" />
                    <StatBadge value={s.red_cards} label="rood" color="text-red-400" />
                  </div>
                ) : (
                  <p className="text-xs text-[var(--subtle2)]">Nog geen statistieken dit seizoen</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
