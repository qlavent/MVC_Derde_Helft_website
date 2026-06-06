import { supabase } from '@/lib/supabase'
import type { Match, CalendarEvent } from '@/lib/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import ThemeToggle from '@/components/ThemeToggle'

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
      state: (m.state === 'finished' || m.outcome != null || new Date(m.startTime) < new Date()) ? 'finished' : m.state === 'live' ? 'live' : 'upcoming',
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

  const [{ data: liveMatches }, { data: recentMatches }, { data: upcomingMatches }, { data: upcomingEvents }, { data: latestKitCarrier }] = await Promise.all([
    supabase.from('matches').select('*').eq('state', 'live').limit(1),
    supabase.from('matches').select('*').eq('state', 'finished').order('start_time', { ascending: false }).limit(5),
    supabase.from('matches').select('*').eq('state', 'upcoming').order('start_time', { ascending: true }).limit(3),
    supabase.from('calendar_events').select('*').gte('start_time', now).order('start_time', { ascending: true }).limit(5),
    supabase.from('kit_carriers').select('*, player:players(first_name, last_name), match:matches(start_time)').order('created_at', { ascending: false }).limit(1).single(),
  ])

  // If Supabase is empty, fall back to RBFA API directly
  const hasSupabaseData = (liveMatches?.length ?? 0) + (recentMatches?.length ?? 0) + (upcomingMatches?.length ?? 0) > 0
  if (!hasSupabaseData) {
    const rbfa = await getRbfaMatches()
    return {
      liveMatches: rbfa.filter((m) => m.state === 'live').slice(0, 1),
      recentMatches: rbfa.filter((m) => m.state === 'finished').reverse().slice(0, 5),
      upcomingMatches: rbfa.filter((m) => m.state === 'upcoming').slice(0, 3),
      upcomingEvents: upcomingEvents,
    }
  }

  return { liveMatches, recentMatches, upcomingMatches, upcomingEvents, latestKitCarrier }
}

function ScoreBadge({ match }: { match: Match }) {
  const home = match.manual_home_score ?? match.rbfa_home_score
  const away = match.manual_away_score ?? match.rbfa_away_score
  if (home === null || away === null) return null
  return (
    <span className="bg-[var(--muted)] rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums">
      {home} — {away}
    </span>
  )
}

export default async function HomePage() {
  const { liveMatches, recentMatches, upcomingMatches, upcomingEvents, latestKitCarrier } = await getData()
  const liveMatch = liveMatches?.[0]

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

      {/* Kit carrier banner */}
      {latestKitCarrier?.player && (
        <div className="mx-4 mb-3">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">🎽</span>
            <div>
              <p className="text-xs text-[var(--subtle)]">Truitjes</p>
              <p className="text-sm font-bold">
                {(latestKitCarrier.player as { first_name: string; last_name: string }).first_name}{' '}
                {(latestKitCarrier.player as { first_name: string; last_name: string }).last_name}{' '}
                heeft de truitjes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live match banner */}
      {liveMatch && (
        <div className="mx-4 mb-4">
          <Link href={`/wedstrijden/${liveMatch.id}`}>
            <div className="bg-gradient-to-r from-red-900/40 to-[var(--surface)] border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-semibold uppercase tracking-wide">Live</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex-1">{liveMatch.home_team_name}</span>
                <ScoreBadge match={liveMatch} />
                <span className="text-sm font-semibold flex-1 text-right">{liveMatch.away_team_name}</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Upcoming */}
      {(upcomingMatches?.length || 0) + (upcomingEvents?.length || 0) > 0 && (
        <section className="px-4 mb-6">
          <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest mb-3">Aankomend</h2>
          <div className="space-y-2">
            {upcomingMatches?.map((m) => (
              <Link key={m.id} href={`/wedstrijden/${m.id}`}>
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] hover:border-[var(--sand)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{m.home_team_name} vs {m.away_team_name}</p>
                      <p className="text-xs text-[var(--subtle)] mt-0.5">
                        {format(new Date(m.start_time), 'EEEE d MMM yyyy • HH:mm', { locale: nl })}
                      </p>
                    </div>
                    <span className="text-[var(--sand)] text-xs">⚽</span>
                  </div>
                </div>
              </Link>
            ))}
            {upcomingEvents?.map((e) => (
              <Link key={e.id} href="/kalender">
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] hover:border-[var(--olive)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{e.title}</p>
                      <p className="text-xs text-[var(--subtle)] mt-0.5">
                        {format(new Date(e.start_time), 'EEEE d MMM yyyy • HH:mm', { locale: nl })}
                      </p>
                    </div>
                    <span className="text-[var(--olive)] text-xs">📅</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent results */}
      {(recentMatches?.length ?? 0) > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest">Uitslagen</h2>
            <Link href="/wedstrijden" className="text-xs text-[var(--sand)]">Alle →</Link>
          </div>
          <div className="space-y-2">
            {recentMatches?.map((m) => (
              <Link key={m.id} href={`/wedstrijden/${m.id}`}>
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] hover:border-[var(--sand)] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm flex-1 truncate">{m.home_team_name}</span>
                    <ScoreBadge match={m} />
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
          <Link href="/instagram" className="flex-1">
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] flex items-center gap-3 hover:border-[var(--sand)] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-base">📸</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Instagram</p>
                <p className="text-xs text-[var(--subtle)]">@mvc.den.derde.helft</p>
              </div>
            </div>
          </Link>
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
