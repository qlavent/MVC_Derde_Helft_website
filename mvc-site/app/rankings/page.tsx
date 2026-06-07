'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Image from 'next/image'

interface Team { name: string; logo: string; position: number; points: number }
interface Series { name: string; serieId: string }
interface OurStats { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number; form: string[] }

const OUR_TEAM = 'DERDE HELFT'

export default function RankingsPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [rankingsBySeries, setRankingsBySeries] = useState<Team[][]>([])
  const [ourStats, setOurStats] = useState<OurStats | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/rbfa-rankings')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setSeries(d.series ?? [])
        // Extract teams from each series ranking
        const byS: Team[][] = (d.rankings ?? []).map((r: { rankings: { teams: Team[] }[] }) =>
          r.rankings?.[0]?.teams ?? []
        )
        setRankingsBySeries(byS)
        setOurStats(d.ourStats ?? null)
        // Default to "reeks" series
        const reeksIdx = (d.series ?? []).findIndex((s: Series) => s.name.toLowerCase().includes('reeks'))
        setActiveIdx(reeksIdx >= 0 ? reeksIdx : 0)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const currentTeams = rankingsBySeries[activeIdx] ?? []
  const formColors: Record<string, string> = {
    W: 'bg-green-500/20 text-green-400',
    G: 'bg-[var(--muted)] text-[var(--subtle)]',
    V: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-4 flex items-center gap-2">
        <Link href="/spelers" className="text-[var(--subtle)]"><ChevronLeft size={18} /></Link>
        <h1 className="text-xl font-black">Rangschikking</h1>
      </div>

      {/* Our stats summary */}
      {ourStats && (
        <div className="mx-4 mb-4 bg-[var(--surface)] rounded-2xl p-4 border border-[var(--sand)]/30">
          <p className="text-xs text-[var(--subtle)] mb-2">MVC Den Derde Helft — seizoensoverzicht</p>
          <div className="flex gap-3 mb-3">
            {[
              { label: 'Gespeeld', v: ourStats.played },
              { label: 'Gewonnen', v: ourStats.wins },
              { label: 'Gelijk', v: ourStats.draws },
              { label: 'Verloren', v: ourStats.losses },
            ].map(s => (
              <div key={s.label} className="flex-1 text-center bg-[var(--muted)] rounded-xl py-2">
                <p className="text-lg font-black">{s.v}</p>
                <p className="text-[9px] text-[var(--subtle)]">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--subtle)] mr-1">Vorm:</span>
            {ourStats.form.map((r, i) => (
              <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${formColors[r] ?? ''}`}>{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Series tabs */}
      {series.length > 1 && (
        <div className="flex px-4 gap-1 mb-4 overflow-x-auto">
          {series.map((s, i) => (
            <button key={s.serieId} onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${activeIdx === i ? 'bg-[var(--sand)] text-[var(--sand-fg)]' : 'bg-[var(--surface)] text-[var(--subtle)]'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Standings table */}
      <div className="px-4 pb-6">
        {loading ? (
          Array.from({length:6}).map((_,i) => <div key={i} className="bg-[var(--surface)] rounded-xl h-12 mb-2 animate-pulse" />)
        ) : error ? (
          <p className="text-center text-red-400 py-8">{error}</p>
        ) : currentTeams.length === 0 ? (
          <p className="text-center text-[var(--subtle)] py-8">Geen standen gevonden</p>
        ) : (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
            {/* Header */}
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
      </div>
    </div>
  )
}
