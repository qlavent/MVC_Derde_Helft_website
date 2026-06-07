'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent, Match } from '@/lib/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import TimeSelect from '@/components/TimeSelect'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { nl as nlLocale } from 'date-fns/locale'

function DateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value ? new Date(value + 'T12:00:00') : null
  return (
    <DatePicker
      selected={selected}
      onChange={(date: Date | null) => {
        if (date) {
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          const d = String(date.getDate()).padStart(2, '0')
          onChange(`${y}-${m}-${d}`)
        } else {
          onChange('')
        }
      }}
      dateFormat="dd/MM/yyyy"
      locale={nlLocale}
      placeholderText="dd/mm/jjjj"
      className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[var(--fg)] text-sm focus:outline-none w-full"
      wrapperClassName="flex-1"
      popperPlacement="bottom-start"
    />
  )
}

export default function KalenderPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [showAdd, setShowAdd] = useState(false)
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
    const startTime = new Date(form.start_date + (form.start_time ? `T${form.start_time}:00` : 'T00:00:00')).toISOString()
    const endTime = form.end_date ? new Date(form.end_date + (form.end_time ? `T${form.end_time}:00` : 'T00:00:00')).toISOString() : null
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

  function copyIcalUrl() {
    const url = `${window.location.origin}/api/calendar.ics`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOffset = (startOfMonth(currentMonth).getDay() + 6) % 7

  function getItemsForDay(date: Date) {
    const matchesOnDay = matches.filter((m) => isSameDay(new Date(m.start_time), date))
    const eventsOnDay = events.filter((e) => isSameDay(new Date(e.start_time), date))
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
            onClick={copyIcalUrl}
            className="flex items-center gap-1.5 text-xs text-[var(--sand)] border border-[var(--sand)]/30 rounded-full px-3 py-1.5"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Gekopieerd!' : 'iCal link'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs bg-[var(--sand)] text-black rounded-full px-3 py-1.5 font-semibold"
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
                  isToday ? 'bg-[var(--sand)] text-black font-bold' :
                  hasItems ? 'bg-[var(--surface)] border border-[var(--olive)]/50' : 'text-[var(--subtle2)]'
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
      <section className="px-4 mb-6 pb-28">
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
                    <p className="text-xs text-[var(--subtle)]">{format(new Date(m.start_time), 'EEEE d MMM • HH:mm', { locale: nl })}</p>
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
              <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--olive)]/20 hover:border-[var(--olive)] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--olive)] font-semibold mb-0.5">📅 {e.event_type}</p>
                    <p className="text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-[var(--subtle)]">{format(new Date(e.start_time), 'EEEE d MMM • HH:mm', { locale: nl })}</p>
                    {e.end_time && <p className="text-xs text-[var(--subtle)]">tot {format(new Date(e.end_time), 'HH:mm', { locale: nl })}</p>}
                    {e.location && <p className="text-xs text-[var(--subtle2)]">📍 {e.location}</p>}
                    {e.description && <p className="text-xs text-[var(--subtle2)] mt-1 line-clamp-2">{e.description}</p>}
                  </div>
                  {e.include_in_ical && (
                    <a
                      href={`/api/calendar.ics?event=${e.id}`}
                      download
                      onClick={(ev) => ev.stopPropagation()}
                      className="text-[10px] text-[var(--subtle)] border border-[var(--border)] rounded-lg px-2 py-1 ml-2 flex-shrink-0"
                    >
                      + Agenda
                    </a>
                  )}
                </div>
              </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Add event modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Nieuw event</h3>
            <div className="space-y-3">
              <input
                placeholder="Titel"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] placeholder-[var(--subtle)] focus:outline-none"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--subtle)] mb-1 block">Start</label>
                  <DateSelect value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
                  <TimeSelect value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[var(--subtle)] mb-1 block">Einde</label>
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.include_in_ical}
                  onChange={(e) => setForm({ ...form, include_in_ical: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Opnemen in agenda sync</span>
              </label>
              <button
                disabled={!form.title || !form.start_date}
                onClick={addEvent}
                className="w-full bg-[var(--sand)] text-black rounded-xl py-3 font-bold disabled:opacity-40"
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
