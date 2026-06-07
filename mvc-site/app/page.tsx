import { supabase } from '@/lib/supabase'
import type { Match, CalendarEvent } from '@/lib/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import ThemeToggle from '@/components/ThemeToggle'
import LiveBanner from '@/components/LiveBanner'
import UpcomingFeed from '@/components/UpcomingFeed'
import KitCarrierBanner from '@/components/KitCarrierBanner'

export const revalidate = 30

async function getRbfaMatches(): Promise<Match[]> {
  try {
    const res = await fetch('https://datalake-prod2018.rbfa.be/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query { teamCalendar(teamId: "345149", language: nl, sortByDate: asc) { id state startTime homeTeam { id name } awayTeam { id name } outcome { homeTeamGoals awayTeamGoals } series { id name } } }` }),
      next: { revalidate: 300 },
    })
    const json = await res.json()
    return (json.data?.teamCalendar ?? []).map((m: { id: string; state: string; startTime: string; homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string }; outcome?: { homeTeamGoals: number; awayTeamGoals: number } | null; series?: { name: string } | null }) => ({
      id: m.id, rbfa_id: m.id,
      home_team_name: m.homeTeam.name, away_team_name: m.awayTeam.name,
      home_team_rbfa_id: m.homeTeam.id, away_team_rbfa_id: m.awayTeam.id,
      start_time: m.startTime,
      state: (() => {
        if (m.state === 'finished' || m.outcome != null) return 'finished'
        const start = new Date(m.startTime)
        const now = new Date()
        const diffMs = now.getTime() - start.getTime()
        if (diffMs > 3600000) return 'finished'
        if (diffMs > 0) return 'live'
        return 'upcoming'
      })(),
      series_name: m.series?.name ?? 'Kern Deinze', is_home_game: m.homeTeam.id === '345149',
      rbfa_home_score: m.outcome?.homeTeamGoals ?? null, rbfa_away_score: m.outcome?.awayTeamGoals ?? null,
      manual_home_score: null, manual_away_score: null, instagram_post_url: null, synced_at: new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

async function getData() {
  const now = new Date().toISOString()

  const [{ data: recentMatches }] = await Promise.all([
    supabase.from('matches').select('*').eq('state', 'finished').order('start_time', { ascending: false }).limit(5),
  ])

  // If Supabase is empty, fall back to RBFA API directly
  const hasSupabaseData = (recentMatches?.length ?? 0) > 0
  if (!hasSupabaseData) {
    const rbfa = await getRbfaMatches()
    return {
      recentMatches: rbfa.filter((m) => m.state === 'finished').reverse().slice(0, 5),
    }
  }

  return { recentMatches }
}


export default async function HomePage() {
  const { recentMatches } = await getData()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
              <img src="/logo.jpg" alt="MVC Den Derde Helft" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">Den Derde Helft</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>Minivoetbal kern Deinze</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Kit carrier banner — client component, auto-refreshes every 30s */}
      <KitCarrierBanner />

      {/* Live match banner — client component, auto-refreshes every 30s */}
      <LiveBanner />

      {/* Upcoming — client component, auto-refreshes every 30s */}
      <UpcomingFeed />

      {/* Recent results */}
      {(recentMatches?.length ?? 0) > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest">Uitslagen</h2>
            <Link href="/wedstrijden" className="text-xs text-[var(--sand)]">Alle →</Link>
          </div>
          <div className="space-y-3">
            {recentMatches?.map((m) => (
              <Link key={m.id} href={`/wedstrijden/${m.id}`}>
                <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--sand)] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm flex-1 truncate">{m.home_team_name}</span>
                    {(m.manual_home_score ?? m.rbfa_home_score) !== null && (
                      <span className="bg-[var(--muted)] rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums">
                        {m.manual_home_score ?? m.rbfa_home_score} — {m.manual_away_score ?? m.rbfa_away_score}
                      </span>
                    )}
                    <span className="text-sm flex-1 text-right truncate">{m.away_team_name}</span>
                  </div>
                  <p className="text-xs text-[var(--subtle2)] mt-1 text-center">
                    {format(new Date(m.start_time), 'd MMM yyyy', { locale: nl })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick links: Instagram + Wiel */}
      <section className="px-4 mb-6">
        <div className="flex gap-3">
          <a href="https://www.instagram.com/mvc.den.derde.helft" target="_blank" rel="noopener noreferrer" className="flex-1">
            <div className="rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Volg ons
            </div>
          </a>
          <Link href="/wiel" className="flex-1">
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] flex items-center gap-3 hover:border-[var(--sand)] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                <span className="text-base">🎡</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Wiel</p>
                <p className="text-xs text-[var(--subtle)]">Draai het wiel</p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
