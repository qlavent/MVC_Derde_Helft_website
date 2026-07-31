import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { formatBrussels } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import LiveBanner from '@/components/LiveBanner'
import UpcomingFeed from '@/components/UpcomingFeed'
import KitCarrierBanner from '@/components/KitCarrierBanner'

export const revalidate = 30

async function getData() {
  const { data: recentMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('state', 'finished')
    .order('start_time', { ascending: false })
    .limit(5)

  return { recentMatches }
}


export default async function HomePage() {
  const { recentMatches } = await getData()

  return (
    // Locked to the viewport and taken out of <main>'s flow, so the global .pb-safe
    // padding (which scrolling pages need to clear the dock) can't add phantom scroll
    // here. This screen clears the dock itself, via --v-dock-clear on the pinned block.
    // overflow-y-auto, not hidden: on a normal phone everything fits and nothing scrolls
    // here, but on a very short viewport (landscape, small devices) the header + both list
    // floors + the button row exceed 100dvh — scrolling degrades gracefully, clipping the
    // buttons off-screen does not.
    <div className="fixed inset-x-0 top-0 mx-auto max-w-lg h-[100dvh] flex flex-col overflow-y-auto overscroll-contain scrollbar-none">
      {/* Pinned: header and the two conditional banners */}
      <div className="flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-[var(--v-top)] pb-[var(--v-gap)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[var(--v-logo)] h-[var(--v-logo)] rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
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

        <KitCarrierBanner />
        <LiveBanner />
      </div>

      {/* Aankomend — sizes to content, scrolls inside when it does not fit */}
      <UpcomingFeed />

      {/* Uitslagen — same deal: heading stays put, the list scrolls under it */}
      {(recentMatches?.length ?? 0) > 0 && (
        <section className="flex-auto min-h-[var(--v-list-floor)] flex flex-col px-4">
          <div className="flex-shrink-0 pb-[var(--v-gap)] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest">Uitslagen</h2>
            <Link href="/wedstrijden" className="text-xs text-[var(--sand)]">Alle →</Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none fade-edges space-y-[var(--v-gap)] pb-1">
          {recentMatches?.slice(0, 5).map((m) => {
            const homeScore = m.manual_home_score ?? m.rbfa_home_score
            const awayScore = m.manual_away_score ?? m.rbfa_away_score
            const ourScore = m.is_home_game ? homeScore : awayScore
            const theirScore = m.is_home_game ? awayScore : homeScore
            const result = ourScore !== null && theirScore !== null ? (ourScore > theirScore ? 'W' : ourScore === theirScore ? 'G' : 'V') : null
            const resultColor = result === 'W' ? 'bg-green-500/20 text-green-400' : result === 'V' ? 'bg-red-500/20 text-red-400' : 'bg-[var(--muted)] text-[var(--subtle)]'
            const hasScore = homeScore !== null && awayScore !== null
            return (
              <Link key={m.id} href={`/wedstrijden/${m.id}`}>
                <div className="bg-[var(--surface)] rounded-2xl p-[var(--v-pad)] border border-[var(--border)] hover:border-[var(--sand)] transition-colors">
                  <div className="flex items-center justify-between mb-[var(--v-gap)]">
                    <span className="text-xs text-[var(--subtle)]">
                      {formatBrussels(m.start_time, 'EEEE d MMM yyyy')}
                    </span>
                    {result && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${resultColor}`}>
                        {result === 'W' ? 'Gewonnen' : result === 'G' ? 'Gelijkspel' : 'Verloren'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold flex-1 truncate ${m.is_home_game ? 'text-[var(--sand)]' : ''}`}>
                      {m.home_team_name}
                    </span>
                    {hasScore ? (
                      <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg px-3 py-1 flex-shrink-0">
                        <span className="text-lg font-bold tabular-nums">{homeScore}</span>
                        <span className="text-[var(--subtle2)] mx-1">—</span>
                        <span className="text-lg font-bold tabular-nums">{awayScore}</span>
                      </div>
                    ) : (
                      <div className="w-12 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-semibold flex-1 text-right truncate ${!m.is_home_game ? 'text-[var(--sand)]' : ''}`}>
                      {m.away_team_name}
                    </span>
                  </div>
                  {m.series_name && (
                    <p className="text-[10px] text-[var(--subtle2)] mt-1.5">{m.series_name}</p>
                  )}
                </div>
              </Link>
            )
          })}
          </div>
        </section>
      )}

      {/* Pinned bottom: quick links — always visible, clears the dock */}
      <div className="flex-shrink-0 px-4 pt-[var(--v-gap)] pb-[var(--v-dock-clear)]">
        <div className="flex gap-3">
          <a href="https://www.instagram.com/mvc.den.derde.helft" target="_blank" rel="noopener noreferrer" className="flex-1">
            <div className="rounded-2xl p-[var(--v-pad)] flex items-center justify-center gap-2 font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Volg ons
            </div>
          </a>
          <Link href="/wiel" className="flex-1">
            <div className="bg-[var(--surface)] rounded-2xl p-[var(--v-pad)] border border-[var(--border)] flex items-center gap-3 hover:border-[var(--sand)] transition-colors">
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
      </div>
    </div>
  )
}
