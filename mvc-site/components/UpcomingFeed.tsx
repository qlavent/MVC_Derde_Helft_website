'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match, CalendarEvent } from '@/lib/types'
import Link from 'next/link'
import { toBrussels } from '@/lib/utils'
import MatchCard from '@/components/MatchCard'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function UpcomingFeed() {
  const [matches, setMatches] = useState<Match[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  async function fetchData() {
    const now = new Date().toISOString()
    const [{ data: matchData }, { data: eventData }] = await Promise.all([
      supabase.from('matches').select('*').eq('state', 'upcoming').order('start_time', { ascending: true }).limit(5),
      supabase.from('calendar_events').select('*').gte('start_time', now).order('start_time', { ascending: true }).limit(5),
    ])
    setMatches(matchData ?? [])
    setEvents((eventData ?? []).filter((e) => new Date(e.start_time) > new Date()))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const eventTypeIcon: Record<string, string> = {
    training: '🏃',
    event: '🎉',
    other: '📌',
  }

  const merged = [
    ...matches.map((m) => ({ type: 'match' as const, time: toBrussels(m.start_time), data: m })),
    ...events.map((e) => ({ type: 'event' as const, time: toBrussels(e.start_time), data: e })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  if (merged.length === 0) return null

  return (
    // flex-auto + a min-height floor: sizes to its content, gives up room to the results
    // list only when the viewport runs out, and never collapses out of sight.
    <section className="flex-auto min-h-[var(--v-list-floor)] flex flex-col px-4 pb-[var(--v-gap)]">
      <h2 className="flex-shrink-0 text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest mb-[var(--v-gap)]">Aankomend</h2>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none fade-edges space-y-[var(--v-gap)] pb-1">
        {merged.map((item) => item.type === 'match' ? (
          // Same card as the wedstrijden list, so a match reads identically wherever it
          // appears: teams on their own sides, kickoff time on the right.
          <MatchCard key={`m-${item.data.id}`} match={item.data} compact />
        ) : (
          <Link key={`e-${item.data.id}`} href={`/kalender/${item.data.id}`}>
            <div className="bg-[var(--surface)] rounded-xl p-[var(--v-pad)] border border-[var(--border)] hover:border-[var(--olive)] transition-colors">
              <div className="flex items-start gap-2">
                <span className="text-base flex-shrink-0">
                  {eventTypeIcon[item.data.event_type] ?? '📅'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words leading-tight">{item.data.title}</p>
                  <p className="text-xs text-[var(--subtle)] mt-0.5">
                    {format(item.time, 'EEEE d MMM • HH:mm', { locale: nl })}
                    {item.data.location && ` · ${item.data.location}`}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
