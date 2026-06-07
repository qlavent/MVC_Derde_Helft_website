'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
    from: `${startYear}-08-01T00:00:00+00:00`,
    to: `${startYear + 1}-07-31T23:59:59+00:00`,
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
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null)

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
      if (matchIds.length === 0) matchIds = null // no matches found, show all
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilter = (q: any, ids: string[] | null) =>
      ids ? q.in('match_id', ids) : q

    const [
      { data: goals },
      { data: cornersTaken },
      { data: cornersHeaded },
      { data: cards },
      { data: motms },
      { data: matchPlayers },
      { data: finishedMatches },
    ] = await Promise.all([
      applyFilter(supabase.from('goals').select('player_id, is_corner_goal, match_id'), matchIds),
      applyFilter(supabase.from('corners').select('taker_id, match_id'), matchIds),
      applyFilter(supabase.from('corners').select('header_id, match_id'), matchIds),
      applyFilter(supabase.from('cards').select('player_id, card_type, match_id'), matchIds),
      applyFilter(supabase.from('motm').select('player_id, match_id'), matchIds),
      applyFilter(supabase.from('match_players').select('player_id, match_id'), matchIds),
      applyFilter(
        supabase.from('matches').select('id, is_home_game, rbfa_home_score, rbfa_away_score, manual_home_score, manual_away_score').eq('state', 'finished'),
        matchIds
      ),
    ])

    // Build a map of match_id -> result for our team
    type MatchResult = 'win' | 'draw' | 'loss'
    const matchResultMap = new Map<string, MatchResult>()
    for (const m of finishedMatches ?? []) {
      const home = m.manual_home_score ?? m.rbfa_home_score
      const away = m.manual_away_score ?? m.rbfa_away_score
      if (home === null || away === null) continue
      const ourScore = m.is_home_game ? home : away
      const theirScore = m.is_home_game ? away : home
      if (ourScore > theirScore) matchResultMap.set(m.id, 'win')
      else if (ourScore === theirScore) matchResultMap.set(m.id, 'draw')
      else matchResultMap.set(m.id, 'loss')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const computed: PlayerStats[] = players.map((p) => {
      const playerMatchIds = (matchPlayers ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((mp: any) => mp.player_id === p.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((mp: any) => mp.match_id as string)

      const playedFinished = playerMatchIds.filter((mid: string) => matchResultMap.has(mid))
      const wins = playedFinished.filter((mid: string) => matchResultMap.get(mid) === 'win').length
      const draws = playedFinished.filter((mid: string) => matchResultMap.get(mid) === 'draw').length
      const losses = playedFinished.filter((mid: string) => matchResultMap.get(mid) === 'loss').length

      return {
        player: p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        goals: (goals ?? []).filter((g: any) => g.player_id === p.id).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        corner_goals: (goals ?? []).filter((g: any) => g.player_id === p.id && g.is_corner_goal).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        corners_taken: (cornersTaken ?? []).filter((c: any) => c.taker_id === p.id).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        corners_headed: (cornersHeaded ?? []).filter((c: any) => c.header_id === p.id).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yellow_cards: (cards ?? []).filter((c: any) => c.player_id === p.id && c.card_type === 'yellow').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        red_cards: (cards ?? []).filter((c: any) => c.player_id === p.id && c.card_type === 'red').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        motm_count: (motms ?? []).filter((m: any) => m.player_id === p.id).length,
        games_played: playedFinished.length,
        wins,
        draws,
        losses,
      }
    })

    setStats(computed.sort((a, b) => b.games_played - a.games_played || b.goals - a.goals || b.motm_count - a.motm_count))
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
      <div className="px-4 mb-4 flex items-center gap-3 flex-wrap">
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
              <div key={s.player.id} onClick={() => setSelectedPlayer(s)} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[var(--sand)]">
                      {s.player.first_name[0]}{s.player.last_name[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{s.player.first_name} {s.player.last_name}</p>
                    {s.games_played > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[var(--subtle2)]">{s.games_played} gespeeld</span>
                        <span className="text-[10px] text-green-400 font-semibold">{s.wins}W</span>
                        <span className="text-[10px] text-[var(--subtle)] font-semibold">{s.draws}G</span>
                        <span className="text-[10px] text-red-400 font-semibold">{s.losses}V</span>
                      </div>
                    )}
                  </div>
                  {s.motm_count > 0 && (
                    <span className="text-xs text-yellow-400 flex-shrink-0">⭐ {s.motm_count}×</span>
                  )}
                  {s.games_played > 0 && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--muted)] flex flex-col items-center justify-center">
                      <span className="text-base font-black tabular-nums text-[var(--sand)]">{s.games_played}</span>
                      <span className="text-[8px] text-[var(--subtle2)] leading-none">wed</span>
                    </div>
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

      {/* Player detail modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'var(--bg)' }}>
          {/* Player list sidebar — scroll to pick another player */}
          <div className="w-20 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
            <button onClick={() => setSelectedPlayer(null)} className="w-full flex items-center justify-center py-2 mb-3 text-[var(--subtle)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            {stats.map((s) => (
              <button
                key={s.player.id}
                onClick={() => setSelectedPlayer(s)}
                className={`w-full flex flex-col items-center gap-1 py-2 px-1 transition-colors ${selectedPlayer.player.id === s.player.id ? 'bg-[var(--sand)]/20' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${selectedPlayer.player.id === s.player.id ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--muted)] text-[var(--fg)]'}`}>
                  {s.player.first_name[0]}{s.player.last_name[0]}
                </div>
                <span className="text-[8px] text-center text-[var(--subtle)] leading-tight">{s.player.first_name}</span>
              </button>
            ))}
          </div>

          {/* Stats detail */}
          <div className="flex-1 overflow-y-auto px-5 pt-12 pb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black">{selectedPlayer.player.first_name} {selectedPlayer.player.last_name}</h2>
              <p className="text-xs text-[var(--subtle)] mt-0.5">Seizoen {selectedSeason === 'all' ? 'Totaal' : selectedSeason}</p>
            </div>

            {/* Main stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
                <p className="text-3xl font-black text-[var(--sand)]">{selectedPlayer.games_played ?? 0}</p>
                <p className="text-xs text-[var(--subtle)] mt-1">Wedstrijden gespeeld</p>
              </div>
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
                <p className="text-3xl font-black text-[var(--sand)]">{selectedPlayer.goals}</p>
                <p className="text-xs text-[var(--subtle)] mt-1">Doelpunten</p>
              </div>
            </div>

            {/* W/D/L */}
            {(selectedPlayer.games_played ?? 0) > 0 && (
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] mb-4">
                <p className="text-xs text-[var(--subtle)] uppercase tracking-wide mb-3">Resultaten</p>
                <div className="flex gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-green-400">{selectedPlayer.wins ?? 0}</p>
                    <p className="text-[10px] text-[var(--subtle)]">Gewonnen</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-[var(--subtle)]">{selectedPlayer.draws ?? 0}</p>
                    <p className="text-[10px] text-[var(--subtle)]">Gelijk</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-red-400">{selectedPlayer.losses ?? 0}</p>
                    <p className="text-[10px] text-[var(--subtle)]">Verloren</p>
                  </div>
                </div>
              </div>
            )}

            {/* Corners */}
            {(selectedPlayer.corners_taken > 0 || selectedPlayer.corners_headed > 0) && (
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] mb-4">
                <p className="text-xs text-[var(--subtle)] uppercase tracking-wide mb-3">Corners</p>
                <div className="flex gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-[var(--olive)]">{selectedPlayer.corners_taken}</p>
                    <p className="text-[10px] text-[var(--subtle)]">Genomen</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-black text-[var(--olive)]">{selectedPlayer.corners_headed}</p>
                    <p className="text-[10px] text-[var(--subtle)]">Gekopt</p>
                  </div>
                  {selectedPlayer.corner_goals > 0 && (
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-black text-[var(--sand)]">{selectedPlayer.corner_goals}</p>
                      <p className="text-[10px] text-[var(--subtle)]">Corner goals</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cards + MOTM */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] text-center">
                <p className="text-2xl font-black text-yellow-400">{selectedPlayer.yellow_cards}</p>
                <p className="text-[10px] text-[var(--subtle)] mt-1">Geel</p>
              </div>
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] text-center">
                <p className="text-2xl font-black text-red-400">{selectedPlayer.red_cards}</p>
                <p className="text-[10px] text-[var(--subtle)] mt-1">Rood</p>
              </div>
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] text-center">
                <p className="text-2xl font-black text-yellow-300">{selectedPlayer.motm_count}</p>
                <p className="text-[10px] text-[var(--subtle)] mt-1">MOTM ⭐</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
