'use client'

import { useEffect, useState } from 'react'
import { Trophy, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface RankingTeam {
  id?: string
  name: string
  logo?: string
  position: number
  points: number
  gamesPlayed?: number
  wins?: number
  draws?: number
  losses?: number
  goalsFor?: number
  goalsAgainst?: number
}

interface SeriesRanking {
  serieId: string
  name: string
  teams: RankingTeam[]
}

interface OurMatch {
  id: string
  home_team_name: string
  away_team_name: string
  home_team_rbfa_id: string | null
  away_team_rbfa_id: string | null
  is_home_game: boolean
  rbfa_home_score: number | null
  rbfa_away_score: number | null
  manual_home_score: number | null
  manual_away_score: number | null
  start_time: string
  state: string
}

interface H2HRecord {
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  lastResult: { date: string; score: string; outcome: 'win' | 'draw' | 'loss' } | null
}

const OUR_TEAM_NAME_FRAGMENT = 'DERDE HELFT'

function isOurTeam(name: string) {
  return name.toUpperCase().includes(OUR_TEAM_NAME_FRAGMENT)
}

function getMatchResult(m: OurMatch): 'win' | 'draw' | 'loss' | null {
  const home = m.manual_home_score ?? m.rbfa_home_score
  const away = m.manual_away_score ?? m.rbfa_away_score
  if (home === null || away === null) return null
  const ourScore = m.is_home_game ? home : away
  const theirScore = m.is_home_game ? away : home
  if (ourScore > theirScore) return 'win'
  if (ourScore === theirScore) return 'draw'
  return 'loss'
}

function getScore(m: OurMatch): string {
  const home = m.manual_home_score ?? m.rbfa_home_score ?? '?'
  const away = m.manual_away_score ?? m.rbfa_away_score ?? '?'
  return `${home}–${away}`
}

function FormBadge({ result }: { result: 'win' | 'draw' | 'loss' }) {
  const map = {
    win: { label: 'W', className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    draw: { label: 'G', className: 'bg-[var(--muted)] text-[var(--subtle)] border border-[var(--border)]' },
    loss: { label: 'V', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  }
  const { label, className } = map[result]
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${className}`}>
      {label}
    </span>
  )
}

export default function RankingsPage() {
  const [series, setSeries] = useState<SeriesRanking[]>([])
  const [ourMatches, setOurMatches] = useState<OurMatch[]>([])
  const [activeSeries, setActiveSeries] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedH2H, setExpandedH2H] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/rbfa-rankings')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setSeries(d.series ?? [])
        setOurMatches(d.ourMatches ?? [])
        if (d.series?.length > 0) setActiveSeries(d.series[0].serieId)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const currentSeries = series.find((s) => s.serieId === activeSeries)

  // Last 5 results (form)
  const last5 = ourMatches
    .filter((m) => getMatchResult(m) !== null)
    .slice(0, 5)
    .map((m) => getMatchResult(m)!)

  // H2H computation
  function computeH2H(opponentName: string): H2HRecord {
    const normalise = (n: string) => n.trim().toUpperCase()
    const oppNorm = normalise(opponentName)
    const relevant = ourMatches.filter((m) => {
      const homeNorm = normalise(m.home_team_name)
      const awayNorm = normalise(m.away_team_name)
      return homeNorm === oppNorm || awayNorm === oppNorm
    })

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
    let lastResult: H2HRecord['lastResult'] = null

    for (const m of relevant) {
      const result = getMatchResult(m)
      if (!result) continue
      const home = m.manual_home_score ?? m.rbfa_home_score ?? 0
      const away = m.manual_away_score ?? m.rbfa_away_score ?? 0
      const ourScore = m.is_home_game ? home : away
      const theirScore = m.is_home_game ? away : home
      goalsFor += ourScore
      goalsAgainst += theirScore
      if (result === 'win') wins++
      else if (result === 'draw') draws++
      else losses++
      if (!lastResult) {
        lastResult = {
          date: m.start_time,
          score: getScore(m),
          outcome: result,
        }
      }
    }

    return { wins, draws, losses, goalsFor, goalsAgainst, lastResult }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--muted)] animate-pulse" />
          <div className="h-6 w-32 bg-[var(--muted)] rounded animate-pulse" />
        </div>
        <div className="px-4 space-y-2 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-[var(--surface)] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <Trophy size={40} className="text-[var(--subtle2)]" />
        <p className="text-[var(--subtle2)] text-center">Kon de rangschikking niet laden.<br />{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-[var(--sand)] border border-[var(--sand)]/30 rounded-full px-4 py-2">
          Opnieuw proberen
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Rangschikking</h1>
        </div>
        <Link href="/spelers" className="flex items-center gap-1 text-[var(--subtle)] text-sm">
          <ChevronLeft size={16} /> Spelers
        </Link>
      </div>

      {/* Form strip (last 5) */}
      {last5.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--subtle)] mb-2 font-semibold">Laatste 5 wedstrijden</p>
            <div className="flex items-center gap-1.5">
              {last5.map((r, i) => <FormBadge key={i} result={r} />)}
            </div>
          </div>
        </div>
      )}

      {/* Series tabs */}
      {series.length > 1 && (
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          {series.map((s) => (
            <button
              key={s.serieId}
              onClick={() => setActiveSeries(s.serieId)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeSeries === s.serieId
                  ? 'bg-[var(--sand)] text-black'
                  : 'bg-[var(--surface)] text-[var(--subtle)] border border-[var(--border)]'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Standings table */}
      {currentSeries && (
        <div className="px-4 space-y-2 mb-6">
          {/* Table header */}
          <div className="flex items-center px-3 py-1 text-[10px] text-[var(--subtle2)] font-semibold uppercase tracking-wider">
            <span className="w-6">#</span>
            <span className="flex-1">Team</span>
            <span className="w-8 text-right">Wed</span>
            <span className="w-8 text-right">Pts</span>
            <span className="w-12 text-right">H2H</span>
          </div>

          {currentSeries.teams.map((team) => {
            const ours = isOurTeam(team.name)
            const h2h = ours ? null : computeH2H(team.name)
            const isExpanded = expandedH2H === team.name

            return (
              <div key={`${team.name}-${team.position}`}>
                <div
                  className={`flex items-center px-3 py-3 rounded-xl border transition-colors ${
                    ours
                      ? 'border-[var(--sand)]/50 bg-[var(--sand)]/10'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  } ${!ours && h2h && (h2h.wins + h2h.draws + h2h.losses) > 0 ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!ours && h2h && (h2h.wins + h2h.draws + h2h.losses) > 0) {
                      setExpandedH2H(isExpanded ? null : team.name)
                    }
                  }}
                >
                  {/* Position */}
                  <span className={`w-6 text-sm font-bold ${ours ? 'text-[var(--sand)]' : 'text-[var(--subtle2)]'}`}>
                    {team.position}
                  </span>

                  {/* Logo + name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {team.logo ? (
                      <img src={team.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--muted)] flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${ours ? 'font-bold text-[var(--sand)]' : 'font-medium'}`}>
                      {team.name}
                    </span>
                    {ours && <span className="text-[10px] text-[var(--sand)]/60 flex-shrink-0">◀</span>}
                  </div>

                  {/* Games played */}
                  <span className="w-8 text-right text-xs text-[var(--subtle)]">
                    {team.gamesPlayed ?? '—'}
                  </span>

                  {/* Points */}
                  <span className={`w-8 text-right text-sm font-bold ${ours ? 'text-[var(--sand)]' : ''}`}>
                    {team.points}
                  </span>

                  {/* H2H mini */}
                  <div className="w-12 flex justify-end">
                    {!ours && h2h && (h2h.wins + h2h.draws + h2h.losses) > 0 && (
                      <div className="flex gap-0.5">
                        {h2h.lastResult && <FormBadge result={h2h.lastResult.outcome} />}
                      </div>
                    )}
                  </div>
                </div>

                {/* H2H expanded */}
                {isExpanded && h2h && (
                  <div className="mx-1 mb-1 bg-[var(--muted)] rounded-b-xl px-4 py-3 border border-[var(--border)] border-t-0 -mt-1">
                    <p className="text-[10px] text-[var(--subtle2)] mb-2 font-semibold uppercase tracking-wider">
                      Onderlinge stand vs {team.name}
                    </p>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-center">
                        <p className="text-lg font-black text-green-400">{h2h.wins}</p>
                        <p className="text-[9px] text-[var(--subtle2)]">Winst</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-[var(--subtle)]">{h2h.draws}</p>
                        <p className="text-[9px] text-[var(--subtle2)]">Gelijk</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-red-400">{h2h.losses}</p>
                        <p className="text-[9px] text-[var(--subtle2)]">Verlies</p>
                      </div>
                      <div className="text-center ml-auto">
                        <p className="text-lg font-black text-[var(--fg)]">{h2h.goalsFor}–{h2h.goalsAgainst}</p>
                        <p className="text-[9px] text-[var(--subtle2)]">Doelpunten</p>
                      </div>
                    </div>
                    {h2h.lastResult && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                        <FormBadge result={h2h.lastResult.outcome} />
                        <span className="text-xs text-[var(--subtle)]">Laatste: {h2h.lastResult.score}</span>
                        <span className="text-xs text-[var(--subtle2)]">
                          {new Date(h2h.lastResult.date).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {series.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Trophy size={40} className="text-[var(--subtle2)]" />
          <p className="text-[var(--subtle2)]">Geen reeksen gevonden</p>
        </div>
      )}
    </div>
  )
}
