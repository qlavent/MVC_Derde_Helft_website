'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match, CalendarEvent } from '@/lib/types'
import Link from 'next/link'
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
    ...matches.map((m) => ({ type: 'match' as const, time: new Date(m.start_time), data: m })),
    ...events.map((e) => ({ type: 'event' as const, time: new Date(e.start_time), data: e })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  if (merged.length === 0) return null

  return (
    <section className="px-4 mb-6">
      <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest mb-3">Aankomend</h2>
      <div className="space-y-2">
        {merged.map((item) => item.type === 'match' ? (
          <Link key={`m-${item.data.id}`} href={`/wedstrijden/${item.data.id}`}>
            <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] hover:border-[var(--sand)] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base flex-shrink-0">⚽</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.data.home_team_name} vs {item.data.away_team_name}</p>
                    <p className="text-xs text-[var(--subtle)] mt-0.5">
                      {format(item.time, 'EEEE d MMM • HH:mm', { locale: nl })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Link key={`e-${item.data.id}`} href={`/kalender/${item.data.id}`}>
            <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] hover:border-[var(--olive)] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-base flex-shrink-0">
                  {eventTypeIcon[item.data.event_type] ?? '📅'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.data.title}</p>
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
