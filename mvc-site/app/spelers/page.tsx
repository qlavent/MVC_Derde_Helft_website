'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player, PlayerStats, CornerDuo } from '@/lib/types'
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

function StatBadge({ value, label, color, display }: { value: number; label: string; color: string; display?: string }) {
  if (value === 0 && !display) return null
  return (
    <div className={`flex flex-col items-center bg-[var(--muted)] rounded-lg px-2 py-1.5 ${color}`}>
      <span className="text-sm font-bold tabular-nums">{display ?? value}</span>
      <span className="text-[9px] text-[var(--subtle)] leading-none mt-0.5">{label}</span>
    </div>
  )
}

type PageTab = 'spelers' | 'duos'

export default function SpelersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [cornerDuos, setCornerDuos] = useState<CornerDuo[]>([])
  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null)
  const [pageTab, setPageTab] = useState<PageTab>('spelers')
  const [sortBy, setSortBy] = useState<'none' | 'goals' | 'games_played' | 'wins' | 'win_pct' | 'motm_count' | 'corners_taken' | 'yellow_cards'>('games_played')

  useEffect(() => {
    loadPlayers()
    loadSeasons()
  }, [])

  useEffect(() => {
    if (players.length > 0) computeStats(selectedSeason)
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

  async function computeStats(season: string) {
    setLoading(true)

    // Fetch ALL data then filter client-side by season (avoids DB IN query issues)
    const [
      { data: allGoals },
      { data: allCorners },
      { data: allCards },
      { data: allMotms },
      { data: allMatchPlayers },
      { data: allFinishedMatches },
    ] = await Promise.all([
      supabase.from('goals').select('player_id, is_corner_goal, match_id'),
      supabase.from('corners').select('taker_id, header_id, is_goal, match_id'),
      supabase.from('cards').select('player_id, card_type, match_id'),
      supabase.from('motm').select('player_id, match_id'),
      supabase.from('match_players').select('player_id, match_id'),
      supabase.from('matches').select('id, start_time, is_home_game, rbfa_home_score, rbfa_away_score, manual_home_score, manual_away_score').eq('state', 'finished'),
    ])

    const allCornersTaken = allCorners
    const allCornersHeaded = allCorners

    // Filter by season client-side
    let seasonMatchIds: Set<string> | null = null
    if (season !== 'all') {
      const { from, to } = seasonDateRange(season)
      const fromMs = new Date(from).getTime()
      const toMs = new Date(to).getTime()
      seasonMatchIds = new Set(
        (allFinishedMatches ?? [])
          .filter((m) => { const t = new Date(m.start_time).getTime(); return t >= fromMs && t <= toMs })
          .map((m) => m.id)
      )
    }

    const fs = <T extends { match_id: string }>(arr: T[] | null) =>
      seasonMatchIds ? (arr ?? []).filter((r) => seasonMatchIds!.has(r.match_id)) : (arr ?? [])

    const goals = fs(allGoals)
    const corners = fs(allCorners)
    const cards = fs(allCards)
    const motms = fs(allMotms)
    const matchPlayers = fs(allMatchPlayers)
    const finishedMatches = seasonMatchIds
      ? (allFinishedMatches ?? []).filter((m) => seasonMatchIds!.has(m.id))
      : (allFinishedMatches ?? [])

    // Aliases for clarity
    const cornersTaken = corners
    const cornersHeaded = corners

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerCornersTaken = (cornersTaken ?? []).filter((c: any) => c.taker_id === p.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerCornersHeaded = (cornersHeaded ?? []).filter((c: any) => c.header_id === p.id)

      return {
        player: p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        goals: (goals ?? []).filter((g: any) => g.player_id === p.id).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        corner_goals: (goals ?? []).filter((g: any) => g.player_id === p.id && g.is_corner_goal).length,
        corners_taken: playerCornersTaken.length,
        corners_headed: playerCornersHeaded.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kicker_goals: playerCornersTaken.filter((c: any) => c.is_goal).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        header_goals: playerCornersHeaded.filter((c: any) => c.is_goal).length,
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

    // Build corner duo stats
    const playerMap = new Map(players.map((p) => [p.id, p]))
    const duoMap = new Map<string, { taker: Player; header: Player; total: number; goals: number }>()
    for (const c of corners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cc = c as any
      if (!cc.taker_id || !cc.header_id) continue
      const key = `${cc.taker_id}::${cc.header_id}`
      const taker = playerMap.get(cc.taker_id)
      const header = playerMap.get(cc.header_id)
      if (!taker || !header) continue
      const existing = duoMap.get(key) ?? { taker, header, total: 0, goals: 0 }
      duoMap.set(key, { ...existing, total: existing.total + 1, goals: existing.goals + (cc.is_goal ? 1 : 0) })
    }
    const duos: CornerDuo[] = Array.from(duoMap.values())
      .filter((d) => d.total >= 1)
      .map((d) => ({ ...d, success_rate: d.goals / d.total }))
      .sort((a, b) => b.success_rate - a.success_rate || b.total - a.total)
    setCornerDuos(duos)

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

      {/* Page tabs */}
      <div className="px-4 mb-4 flex gap-2">
        <button
          onClick={() => setPageTab('spelers')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${pageTab === 'spelers' ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--surface)] text-[var(--subtle)]'}`}
        >
          Spelers
        </button>
        <button
          onClick={() => setPageTab('duos')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${pageTab === 'duos' ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--surface)] text-[var(--subtle)]'}`}
        >
          Corner duo&apos;s
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

      {/* Sort pills — only on spelers tab */}
      {pageTab === 'spelers' && !loading && players.length > 0 && (
        <div className="px-4 mb-3">
          <div className="relative inline-block w-full">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer">
              <option value="none">Alfabetisch</option>
              <option value="games_played">Meest gespeeld</option>
              <option value="goals">Meeste goals</option>
              <option value="wins">Meeste overwinningen</option>
              <option value="win_pct">Beste winstpercentage</option>
              <option value="motm_count">Meeste MOTM</option>
              <option value="corners_taken">Meeste corners genomen</option>
              <option value="yellow_cards">Meeste gele kaarten</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      )}

      {/* Corner duo's tab */}
      {pageTab === 'duos' && (
        <div className="px-4 space-y-3 pb-28">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[var(--surface)] rounded-2xl h-20 animate-pulse" />
            ))
          ) : cornerDuos.length === 0 ? (
            <div className="text-center text-[var(--subtle2)] py-12">
              <p className="text-3xl mb-2">🎯</p>
              <p>Nog geen corner data</p>
            </div>
          ) : (
            cornerDuos.map((duo, idx) => (
              <div key={`${duo.taker.id}-${duo.header.id}`} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black text-[var(--subtle2)] w-5 flex-shrink-0 text-right">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{duo.taker.first_name} {duo.taker.last_name}</span>
                      <span className="text-[var(--subtle)] text-xs">→</span>
                      <span className="text-sm font-bold">{duo.header.first_name} {duo.header.last_name}</span>
                    </div>
                    <p className="text-[10px] text-[var(--subtle)] mt-0.5">Nemer → Kopper</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-black text-[var(--sand)]">{Math.round(duo.success_rate * 100)}%</p>
                    <p className="text-[9px] text-[var(--subtle)]">succes</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-[var(--muted)] rounded-xl p-2 text-center">
                    <p className="text-lg font-black text-[var(--fg)]">{duo.total}</p>
                    <p className="text-[9px] text-[var(--subtle)]">corners</p>
                  </div>
                  <div className="flex-1 bg-[var(--muted)] rounded-xl p-2 text-center">
                    <p className="text-lg font-black text-[#22C55E]">{duo.goals}</p>
                    <p className="text-[9px] text-[var(--subtle)]">goals</p>
                  </div>
                  <div className="flex-1 bg-[var(--muted)] rounded-xl p-2 text-center">
                    <p className="text-lg font-black text-[var(--fg)]">{duo.total - duo.goals}</p>
                    <p className="text-[9px] text-[var(--subtle)]">mislukt</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Spelers tab */}
      {pageTab === 'spelers' && <div className="px-4 space-y-3 pb-28">
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
          [...stats].sort((a, b) => {
            if (sortBy === 'none') return `${a.player.last_name} ${a.player.first_name}`.localeCompare(`${b.player.last_name} ${b.player.first_name}`)
            if (sortBy === 'win_pct') {
              const pctA = (a.games_played ?? 0) > 0 ? (a.wins ?? 0) / (a.games_played ?? 1) : 0
              const pctB = (b.games_played ?? 0) > 0 ? (b.wins ?? 0) / (b.games_played ?? 1) : 0
              return pctB - pctA
            }
            return (b[sortBy as keyof typeof b] as number ?? 0) - (a[sortBy as keyof typeof a] as number ?? 0)
          }).map((s, idx) => {
            const hasStats = (s.games_played ?? 0) > 0 || s.goals > 0 || s.corners_taken > 0 || s.corners_headed > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.motm_count > 0
            return (
              <div key={s.player.id} onClick={() => setSelectedPlayer(s)} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black text-[var(--subtle2)] w-5 flex-shrink-0 text-right">#{idx + 1}</span>
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
                    <StatBadge value={s.goals} label="goals" color="text-[#22C55E]" />
                    {s.corners_taken > 0 && <StatBadge value={s.corners_taken} display={`${Math.round((s.kicker_goals / s.corners_taken) * 100)}%`} label={`nemer · ${s.kicker_goals}/${s.corners_taken}`} color="text-[var(--fg)]" />}
                    {s.corners_headed > 0 && <StatBadge value={s.corners_headed} display={`${Math.round((s.header_goals / s.corners_headed) * 100)}%`} label={`kopper · ${s.header_goals}/${s.corners_headed}`} color="text-[var(--fg)]" />}
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
      </div>}

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
            <div className="h-28" />
          </div>

          {/* Stats detail */}
          <div className="flex-1 overflow-y-auto px-5 pt-12 pb-28">
            <div className="mb-6">
              <h2 className="text-2xl font-black">{selectedPlayer.player.first_name} {selectedPlayer.player.last_name}</h2>
              <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="mt-1 text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--fg)] focus:outline-none cursor-pointer">
                <option value="all">Alle seizoenen</option>
                {seasons.map((s) => <option key={s} value={s}>Seizoen {s}</option>)}
              </select>
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

            {/* W/D/L + win % */}
            {(selectedPlayer.games_played ?? 0) > 0 && (
              <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[var(--subtle)] uppercase tracking-wide">Resultaten</p>
                  <span className="text-xl font-black text-[var(--sand)]">
                    {Math.round(((selectedPlayer.wins ?? 0) / (selectedPlayer.games_played ?? 1)) * 100)}%
                  </span>
                </div>
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
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {selectedPlayer.corners_taken > 0 && (
                    <div className="bg-[var(--muted)] rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-[var(--fg)]">
                        {Math.round((selectedPlayer.kicker_goals / selectedPlayer.corners_taken) * 100)}%
                      </p>
                      <p className="text-[10px] text-[var(--subtle)]">gescoord (nemer)</p>
                      <p className="text-[9px] text-[var(--subtle2)] mt-1">{selectedPlayer.kicker_goals}/{selectedPlayer.corners_taken} corners</p>
                    </div>
                  )}
                  {selectedPlayer.corners_headed > 0 && (
                    <div className="bg-[var(--muted)] rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-[var(--fg)]">
                        {Math.round((selectedPlayer.header_goals / selectedPlayer.corners_headed) * 100)}%
                      </p>
                      <p className="text-[10px] text-[var(--subtle)]">gescoord (kopper)</p>
                      <p className="text-[9px] text-[var(--subtle2)] mt-1">{selectedPlayer.header_goals}/{selectedPlayer.corners_headed} corners</p>
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
