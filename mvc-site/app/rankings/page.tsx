'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'

interface Team { name: string; logo: string; position: number; points: number }
interface Series { name: string; serieId: string }
interface OurStats { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number; form: string[] }

const OUR_TEAM = 'DERDE HELFT'

function getSeason(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const startYear = d.getMonth() >= 7 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

function computeStats(matches: Match[]): OurStats {
  const finished = matches.filter(m => m.rbfa_home_score !== null)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
  const results: string[] = []

  for (const m of finished) {
    const our = m.is_home_game ? (m.rbfa_home_score ?? 0) : (m.rbfa_away_score ?? 0)
    const their = m.is_home_game ? (m.rbfa_away_score ?? 0) : (m.rbfa_home_score ?? 0)
    goalsFor += our; goalsAgainst += their
    if (our > their) { wins++; results.push('W') }
    else if (our === their) { draws++; results.push('G') }
    else { losses++; results.push('V') }
  }

  return {
    played: finished.length, wins, draws, losses,
    goalsFor, goalsAgainst,
    points: wins * 3 + draws,
    form: results.slice(-5),
  }
}

export default function RankingsPage() {
  const currentSeason = getSeason(new Date().toISOString())

  const [seasons, setSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState(currentSeason)
  const [localStats, setLocalStats] = useState<OurStats | null>(null)

  // Standings — RBFA for current season, Supabase snapshot for historical
  const [series, setSeries] = useState<Series[]>([])
  const [rankingsBySeries, setRankingsBySeries] = useState<Team[][]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [rbfaLoading, setRbfaLoading] = useState(true)
  const [rbfaError, setRbfaError] = useState<string | null>(null)

  const isCurrentSeason = selectedSeason === currentSeason

  // Load seasons + local stats from Supabase
  useEffect(() => {
    supabase.from('matches').select('*').order('start_time').then(({ data }) => {
      const matches = (data ?? []) as Match[]
      const seasonSet = new Set(matches.map(m => getSeason(m.start_time)))
      const sorted = Array.from(seasonSet).sort().reverse()
      setSeasons(sorted)
      if (!sorted.includes(currentSeason) && sorted.length > 0) setSelectedSeason(sorted[0])
      const seasonMatches = matches.filter(m => getSeason(m.start_time) === selectedSeason)
      setLocalStats(computeStats(seasonMatches))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute local stats when season changes
  useEffect(() => {
    supabase.from('matches').select('*')
      .then(({ data }) => {
        const matches = ((data ?? []) as Match[]).filter(m => getSeason(m.start_time) === selectedSeason)
        setLocalStats(computeStats(matches))
      })
  }, [selectedSeason])

  // Load standings: RBFA for current season, Supabase snapshot for historical
  useEffect(() => {
    setRbfaLoading(true)
    setRbfaError(null)

    if (isCurrentSeason) {
      fetch('/api/rbfa-rankings')
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error)
          setSeries(d.series ?? [])
          const byS: Team[][] = (d.rankings ?? []).map((r: { rankings: { teams: Team[] }[] }) =>
            r.rankings?.[0]?.teams ?? []
          )
          setRankingsBySeries(byS)
          const reeksIdx = (d.series ?? []).findIndex((s: Series) => s.name.toLowerCase().includes('reeks'))
          setActiveIdx(reeksIdx >= 0 ? reeksIdx : 0)
        })
        .catch(e => setRbfaError(e.message))
        .finally(() => setRbfaLoading(false))
    } else {
      // Read snapshot from Supabase
      supabase
        .from('rankings_snapshots')
        .select('*')
        .eq('season', selectedSeason)
        .order('position')
        .then(({ data, error }) => {
          if (error) throw new Error(error.message)
          const rows = data ?? []
          // Group by serie
          const serieMap = new Map<string, { name: string; serieId: string; teams: Team[] }>()
          for (const r of rows) {
            if (!serieMap.has(r.serie_id)) {
              serieMap.set(r.serie_id, { name: r.serie_name, serieId: r.serie_id, teams: [] })
            }
            serieMap.get(r.serie_id)!.teams.push({
              name: r.team_name, logo: r.team_logo ?? '', position: r.position, points: r.points,
            })
          }
          const serieList = Array.from(serieMap.values())
          setSeries(serieList.map(s => ({ name: s.name, serieId: s.serieId })))
          setRankingsBySeries(serieList.map(s => s.teams))
          const reeksIdx = serieList.findIndex(s => s.name.toLowerCase().includes('reeks'))
          setActiveIdx(reeksIdx >= 0 ? reeksIdx : 0)
        })
        .catch((e: Error) => setRbfaError(e.message))
        .finally(() => setRbfaLoading(false))
    }
  }, [selectedSeason, isCurrentSeason])

  const currentTeams = rankingsBySeries[activeIdx] ?? []
  const formColors: Record<string, string> = {
    W: 'bg-green-500/20 text-green-400',
    G: 'bg-[var(--muted)] text-[var(--subtle)]',
    V: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-4 flex items-center gap-2">
        <Link href="/wedstrijden" className="text-[var(--subtle)]"><ChevronLeft size={18} /></Link>
        <h1 className="text-xl font-black">Rangschikking</h1>
      </div>

      {/* Season selector */}
      {seasons.length > 0 && (
        <div className="px-4 mb-4">
          <div className="relative inline-block">
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
              className="appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-4 pr-8 py-2 text-sm font-semibold focus:outline-none focus:border-[var(--sand)] cursor-pointer"
            >
              {seasons.map(s => (
                <option key={s} value={s}>Seizoen {s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none" />
          </div>
        </div>
      )}

      {/* Our stats — from local Supabase data (works for all seasons) */}
      {localStats && localStats.played > 0 && (
        <div className="mx-4 mb-4 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--sand)]/30">
          <p className="text-xs text-[var(--subtle)] mb-2">MVC Den Derde Helft — {selectedSeason}</p>
          <div className="flex gap-3 mb-3">
            {[
              { label: 'Gespeeld', v: localStats.played },
              { label: 'Gewonnen', v: localStats.wins },
              { label: 'Gelijk', v: localStats.draws },
              { label: 'Verloren', v: localStats.losses },
            ].map(s => (
              <div key={s.label} className="flex-1 text-center bg-[var(--muted)] rounded-xl py-2">
                <p className="text-lg font-black">{s.v}</p>
                <p className="text-[9px] text-[var(--subtle)]">{s.label}</p>
              </div>
            ))}
          </div>
          {localStats.form.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--subtle)] mr-1">Vorm:</span>
              {localStats.form.map((r, i) => (
                <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${formColors[r] ?? ''}`}>{r}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full standings — RBFA, current season only */}
      <div className="px-4 pb-28">
        {rbfaLoading ? (
          Array.from({length:6}).map((_,i) => <div key={i} className="bg-[var(--surface)] rounded-xl h-12 mb-2 animate-pulse" />)
        ) : rbfaError ? (
          <p className="text-center text-red-400 py-8 text-sm">{rbfaError}</p>
        ) : (
          <>
            {/* Series tabs */}
            {series.length > 1 && (
              <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none">
                {series.map((s, i) => (
                  <button key={s.serieId} onClick={() => setActiveIdx(i)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${activeIdx === i ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--surface)] text-[var(--subtle)]'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {currentTeams.length === 0 ? (
              <p className="text-center text-[var(--subtle)] py-8 text-sm">Geen standen gevonden</p>
            ) : (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="flex items-center px-4 py-2 border-b border-[var(--border)] text-[10px] text-[var(--subtle)] uppercase tracking-wide">
                  <span className="w-6">#</span>
                  <span className="flex-1">Team</span>
                  <span className="w-8 text-center">Pts</span>
                </div>
                {currentTeams.map((team, i) => {
                  const isUs = team.name.toUpperCase().includes(OUR_TEAM)
                  return (
                    <div key={i} className={`flex items-center px-4 py-3 border-b border-[var(--border)] last:border-0 ${isUs ? 'bg-[var(--sand)]/10' : ''}`}>
                      <span className={`w-6 text-sm font-bold ${isUs ? 'text-[var(--sand)]' : 'text-[var(--subtle)]'}`}>{team.position}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {team.logo && !team.logo.includes('no_logo') && (
                          <img src={team.logo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        )}
                        <span className={`text-sm truncate ${isUs ? 'font-bold text-[var(--sand)]' : ''}`}>{team.name}</span>
                        {isUs && <span className="text-[10px] bg-[var(--sand)] text-[var(--sand-fg)] px-1.5 py-0.5 rounded-full flex-shrink-0">Wij</span>}
                      </div>
                      <span className={`w-8 text-center text-sm font-black ${isUs ? 'text-[var(--sand)]' : ''}`}>{team.points}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
