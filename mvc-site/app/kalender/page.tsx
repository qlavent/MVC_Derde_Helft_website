'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useScrollLock } from '@/lib/useScrollLock'
import type { CalendarEvent, Match } from '@/lib/types'
import { toBrussels, formatBrussels, brusselsFormToUtcIso } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Copy, Check, CalendarPlus } from 'lucide-react'
import Link from 'next/link'
import TimeSelect from '@/components/TimeSelect'
import DateSelect from '@/components/DateSelect'

export default function KalenderPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showSubscribe, setShowSubscribe] = useState(false)
  useScrollLock(showAdd || showSubscribe)
  // Default to whatever the visitor is holding; they can still switch tabs.
  const [device, setDevice] = useState<'android' | 'iphone'>(
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? 'iphone' : 'android'
  )
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ title: '', start_date: '', start_time: '', end_date: '', end_time: '', location: '', description: '', include_in_ical: true })

  useEffect(() => {
    fetchData()
  }, [currentMonth])

  async function fetchData() {
    const start = startOfMonth(currentMonth).toISOString()
    const end = endOfMonth(currentMonth).toISOString()
    const [{ data: evData }, { data: matchData }] = await Promise.all([
      supabase.from('calendar_events').select('*').gte('start_time', start).lte('start_time', end).order('start_time'),
      supabase.from('matches').select('*').gte('start_time', start).lte('start_time', end).order('start_time'),
    ])
    setEvents(evData ?? [])
    setMatches(matchData ?? [])
  }

  async function addEvent() {
    if (!form.title || !form.start_date) return
    // Form input is Brussels wall-clock time, whatever timezone the device is in.
    const startTime = brusselsFormToUtcIso(form.start_date, form.start_time)
    const endTime = form.end_date ? brusselsFormToUtcIso(form.end_date, form.end_time) : null
    await supabase.from('calendar_events').insert({
      title: form.title,
      start_time: startTime,
      end_time: endTime,
      location: form.location || null,
      description: form.description || null,
      include_in_ical: form.include_in_ical,
    })
    setShowAdd(false)
    setForm({ title: '', start_date: '', start_time: '', end_date: '', end_time: '', location: '', description: '', include_in_ical: true })
    fetchData()
  }

  const icalUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/api/calendar.ics`

  function copyIcalUrl() {
    navigator.clipboard.writeText(icalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOffset = (startOfMonth(currentMonth).getDay() + 6) % 7

  function getItemsForDay(date: Date) {
    const matchesOnDay = matches.filter((m) => isSameDay(toBrussels(m.start_time), date))
    const eventsOnDay = events.filter((e) => isSameDay(toBrussels(e.start_time), date))
    return { matchesOnDay, eventsOnDay }
  }

  // Upcoming items (all months)
  const allUpcoming = [...matches, ...events]
    .map((item) => ({ ...item, _isMatch: 'state' in item }))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  function singleIcsUrl(type: 'match' | 'event', id: string) {
    return `/api/calendar.ics?${type}=${id}`
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Kalender</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSubscribe(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--sand)] border border-sand-30 rounded-full px-3 py-1.5"
          >
            <CalendarPlus size={12} /> In agenda
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs bg-[var(--sand)] text-[var(--sand-fg)] rounded-full px-3 py-1.5 font-semibold"
          >
            <Plus size={12} /> Nieuw
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-full bg-[var(--surface)]">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full bg-[var(--surface)]">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-7 mb-1">
          {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
            <div key={d} className="text-center text-[10px] text-[var(--subtle2)] py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const { matchesOnDay, eventsOnDay } = getItemsForDay(day)
            const hasItems = matchesOnDay.length > 0 || eventsOnDay.length > 0
            const isToday = isSameDay(day, new Date())
            return (
              <div
                key={day.toISOString()}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs relative ${
                  isToday ? 'bg-[var(--sand)] text-[var(--sand-fg)] font-bold' :
                  hasItems ? 'bg-[var(--surface)] border border-olive-50' : 'text-[var(--subtle2)]'
                }`}
              >
                {format(day, 'd')}
                {hasItems && !isToday && (
                  <div className="flex gap-0.5 mt-0.5">
                    {matchesOnDay.length > 0 && <span className="w-1 h-1 bg-[var(--sand)] rounded-full" />}
                    {eventsOnDay.length > 0 && <span className="w-1 h-1 bg-[var(--olive)] rounded-full" />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Events list */}
      <section className="px-4 mb-6">
        <h2 className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-widest mb-3">
          {format(currentMonth, 'MMMM', { locale: nl })}
        </h2>
        {allUpcoming.length === 0 ? (
          <p className="text-center text-[var(--subtle2)] py-8">Geen events deze maand</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--sand)] font-semibold mb-0.5">⚽ Wedstrijd</p>
                    <p className="text-sm font-semibold">{m.home_team_name} vs {m.away_team_name}</p>
                    <p className="text-xs text-[var(--subtle)]">
                      {formatBrussels(m.start_time, 'EEEE d MMM • HH:mm')}
                      {m.location_name && ` • ${m.location_name}`}
                    </p>
                  </div>
                  <a
                    href={`/api/calendar.ics?match=${m.id}`}
                    download
                    className="text-[10px] text-[var(--subtle)] border border-[var(--border)] rounded-lg px-2 py-1 ml-2 flex-shrink-0"
                  >
                    + Agenda
                  </a>
                </div>
              </div>
            ))}
            {events.map((e) => (
              <Link key={e.id} href={`/kalender/${e.id}`}>
              <div className="bg-[var(--surface)] rounded-xl p-3 border border-olive-20 hover:border-[var(--olive)] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--olive)] font-semibold mb-0.5">📅 {e.event_type}</p>
                    <p className="text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-[var(--subtle)]">{formatBrussels(e.start_time, 'EEEE d MMM • HH:mm')}</p>
                    {e.end_time && <p className="text-xs text-[var(--subtle)]">tot {formatBrussels(e.end_time, 'HH:mm')}</p>}
                    {e.location && <p className="text-xs text-[var(--subtle2)]">📍 {e.location}</p>}
                    {e.description && <p className="text-xs text-[var(--subtle2)] mt-1 line-clamp-2">{e.description}</p>}
                  </div>
                  {/* Always offered: include_in_ical only controls the shared feed, it does
                      not stop someone adding this one event to their own calendar. */}
                  <a
                    href={`/api/calendar.ics?event=${e.id}`}
                    download
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-[10px] text-[var(--subtle)] border border-[var(--border)] rounded-lg px-2 py-1 ml-2 flex-shrink-0"
                  >
                    + Agenda
                  </a>
                </div>
              </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Add event modal */}
      {showSubscribe && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowSubscribe(false)}>
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Agenda synchroniseren</h3>
            <p className="text-xs text-[var(--subtle)] mb-4">
              Alle wedstrijden en events automatisch in je eigen agenda.
            </p>

            <div className="bg-[var(--muted)] rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2">
              <span className="text-[11px] break-all flex-1 leading-snug">{icalUrl}</span>
              <button onClick={copyIcalUrl} className="flex-shrink-0 text-[var(--sand)]" aria-label="Kopieer link">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {/* Pick your own device — each platform gets its own one-tap link, because the
                shortcuts differ: Google needs a cid deep link, iOS opens on webcal://. */}
            <div className="flex gap-1 mb-4">
              {([
                { key: 'android' as const, label: '📱 Android' },
                { key: 'iphone' as const, label: '🍏 iPhone' },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDevice(t.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    device === t.key
                      ? 'bg-[var(--sand)] text-[var(--sand-fg)]'
                      : 'bg-[var(--muted)] text-[var(--subtle)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {device === 'android' ? (
              <div className="text-xs leading-relaxed">
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icalUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm font-semibold bg-[var(--sand)] text-[var(--sand-fg)] rounded-xl px-4 py-3 mb-3"
                >
                  Toevoegen aan Google Agenda
                </a>
                <p className="text-[var(--subtle)] mb-2">Lukt dat niet? Dan handmatig:</p>
                <ol className="text-[var(--subtle)] space-y-1.5 list-decimal pl-4">
                  <li>Open <span className="text-[var(--fg)]">calendar.google.com</span> in je browser, in desktopweergave.</li>
                  <li>Links onderaan: <span className="text-[var(--fg)]">Andere agenda&apos;s</span> → <span className="text-[var(--fg)]">+</span> → <span className="text-[var(--fg)]">Via URL</span>.</li>
                  <li>Plak de link hierboven en klik <span className="text-[var(--fg)]">Agenda toevoegen</span>.</li>
                  <li>Open de Google Agenda-app en zet het vinkje aan bij de nieuwe agenda.</li>
                </ol>
              </div>
            ) : (
              <div className="text-xs leading-relaxed">
                <a
                  href={icalUrl.replace(/^https?:/, 'webcal:')}
                  className="block text-center text-sm font-semibold bg-[var(--sand)] text-[var(--sand-fg)] rounded-xl px-4 py-3 mb-3"
                >
                  Abonneren op agenda
                </a>
                <p className="text-[var(--subtle)] mb-2">Lukt dat niet? Dan handmatig:</p>
                <ol className="text-[var(--subtle)] space-y-1.5 list-decimal pl-4">
                  <li>Open <span className="text-[var(--fg)]">Instellingen</span> → <span className="text-[var(--fg)]">Apps</span> → <span className="text-[var(--fg)]">Agenda</span> → <span className="text-[var(--fg)]">Agenda-accounts</span>.</li>
                  <li>Tik <span className="text-[var(--fg)]">Account toevoegen</span> → <span className="text-[var(--fg)]">Andere</span>.</li>
                  <li>Tik <span className="text-[var(--fg)]">Geabonneerde agenda toevoegen</span>.</li>
                  <li>Plak de link hierboven en tik <span className="text-[var(--fg)]">Volgende</span> → <span className="text-[var(--fg)]">Bewaar</span>.</li>
                </ol>
              </div>
            )}

            <p className="text-[11px] text-[var(--subtle2)] leading-relaxed mt-4 pt-3 border-t border-[var(--border)]">
              <span className="text-[var(--subtle)]">Hoe snel verschijnt een nieuw event?</span> Je telefoon haalt de
              agenda zelf op: iPhone meestal binnen een uur, Google Agenda soms pas na een dag. Dat kunnen wij niet
              versnellen. Moet iets er nu in staan? Gebruik dan de agenda-knop bij die wedstrijd of dat event.
            </p>

            <button onClick={() => setShowSubscribe(false)} className="w-full mt-5 text-sm text-[var(--subtle)] py-2">
              Sluiten
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Nieuw event</h3>
            {/* Same layout as the edit form on the event page: start and end each get a
                full-width row with the date and time next to each other, rather than two
                cramped columns. */}
            <div className="space-y-4">
              <input
                placeholder="Titel"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] placeholder-[var(--subtle)] focus:outline-none"
              />
              <div>
                <label className="text-[10px] text-[var(--subtle)] mb-1 block">Start</label>
                <div className="flex gap-2">
                  <DateSelect value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
                  <TimeSelect value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[var(--subtle)] mb-1 block">Einde</label>
                <div className="flex gap-2">
                  <DateSelect value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
                  <TimeSelect value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
                </div>
              </div>
              <input
                placeholder="Locatie"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] placeholder-[var(--subtle)] focus:outline-none"
              />
              <textarea
                placeholder="Beschrijving / notities"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] placeholder-[var(--subtle)] focus:outline-none resize-none"
              />
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.include_in_ical}
                  onChange={(e) => setForm({ ...form, include_in_ical: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="text-sm">Opnemen in agenda sync</span>
                  <p className="text-[10px] text-[var(--subtle)] leading-snug">
                    Zet dit aan om het event mee te sturen naar iedereen die de hele agenda volgt.
                    Los toevoegen met de agenda-knop kan altijd, ook als dit uit staat.
                  </p>
                </div>
              </label>
              <button
                disabled={!form.title || !form.start_date}
                onClick={addEvent}
                className="w-full bg-[var(--sand)] text-[var(--sand-fg)] rounded-xl py-3 font-bold disabled:opacity-40"
              >
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
