'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from '@/lib/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Picker from 'react-mobile-picker'
import TimeSelect from '@/components/TimeSelect'

const HOURS = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'))
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55']

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm] = useState({
    title: '', start_date: '', start_time: '', end_date: '', end_time: '', location: '', description: '', include_in_ical: true
  })

  useEffect(() => {
    fetchEvent()
  }, [id])

  async function fetchEvent() {
    const { data } = await supabase.from('calendar_events').select('*').eq('id', id).single()
    setEvent(data)
    if (data) {
      const start = new Date(data.start_time)
      const end = data.end_time ? new Date(data.end_time) : null
      setForm({
        title: data.title,
        start_date: format(start, 'yyyy-MM-dd'),
        start_time: format(start, 'HH:mm'),
        end_date: end ? format(end, 'yyyy-MM-dd') : '',
        end_time: end ? format(end, 'HH:mm') : '',
        location: data.location ?? '',
        description: data.description ?? '',
        include_in_ical: data.include_in_ical,
      })
    }
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.title || !form.start_date) return
    const startTime = form.start_date + (form.start_time ? `T${form.start_time}:00` : 'T00:00:00')
    const endTime = form.end_date ? form.end_date + (form.end_time ? `T${form.end_time}:00` : 'T00:00:00') : null
    await supabase.from('calendar_events').update({
      title: form.title,
      start_time: startTime,
      end_time: endTime,
      location: form.location || null,
      description: form.description || null,
      include_in_ical: form.include_in_ical,
    }).eq('id', id)
    setEditing(false)
    fetchEvent()
  }

  async function deleteEvent() {
    await supabase.from('calendar_events').delete().eq('id', id)
    router.push('/kalender')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--sand)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!event) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-[var(--subtle)]">Event niet gevonden</p>
      <Link href="/kalender" className="text-[var(--sand)] text-sm">← Terug</Link>
    </div>
  )

  const startDate = new Date(event.start_time)
  const endDate = event.end_time ? new Date(event.end_time) : null

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <Link href="/kalender" className="flex items-center gap-1 text-[var(--subtle)] text-sm">
          <ChevronLeft size={16} /> Kalender
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--sand)] text-[var(--sand)]"
          >
            {editing ? 'Annuleer' : 'Bewerk'}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-red-500/30 text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {editing ? (
        /* Edit form */
        <div className="px-4 space-y-4">
          <input
            placeholder="Titel"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none"
          />
          <div>
            <label className="text-[10px] text-[var(--subtle)] mb-1 block">Start</label>
            <div className="flex gap-2">
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[var(--fg)] text-sm focus:outline-none" />
              <TimeSelect value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--subtle)] mb-1 block">Einde</label>
            <div className="flex gap-2">
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[var(--fg)] text-sm focus:outline-none" />
              <TimeSelect value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
            </div>
          </div>
          <input
            placeholder="Locatie"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none"
          />
          <textarea
            placeholder="Beschrijving / notities"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none resize-none"
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.include_in_ical} onChange={(e) => setForm({ ...form, include_in_ical: e.target.checked })} className="w-5 h-5 rounded" />
            <span className="text-sm">Opnemen in agenda sync</span>
          </label>
          <button
            disabled={!form.title || !form.start_date}
            onClick={saveEvent}
            className="w-full bg-[var(--sand)] text-[var(--sand-fg)] rounded-xl py-3 font-bold disabled:opacity-40"
          >
            Opslaan
          </button>
        </div>
      ) : (
        /* View mode */
        <div className="px-4 space-y-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)]">
            <h1 className="text-xl font-black mb-4">{event.title}</h1>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Start</p>
                <p className="text-sm font-semibold">{format(startDate, 'EEEE d MMMM yyyy • HH:mm', { locale: nl })}</p>
              </div>

              {endDate && (
                <div>
                  <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Einde</p>
                  <p className="text-sm font-semibold">{format(endDate, 'EEEE d MMMM yyyy • HH:mm', { locale: nl })}</p>
                </div>
              )}

              {event.location && (
                <div>
                  <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Locatie</p>
                  <p className="text-sm">{event.location}</p>
                </div>
              )}

              {event.description && (
                <div>
                  <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Beschrijving</p>
                  <p className="text-sm whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
            </div>
          </div>

          {event.include_in_ical && (
            <a
              href={`/api/calendar.ics?event=${event.id}`}
              download
              className="flex items-center justify-center gap-2 w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-3 text-sm font-semibold"
            >
              📅 Voeg toe aan agenda
            </a>
          )}
        </div>
      )}

      {/* Delete confirm modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => setShowDelete(false)}>
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Event verwijderen?</h3>
            <p className="text-sm text-[var(--subtle)] mb-5">Dit kan niet ongedaan worden.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 bg-[var(--muted)] rounded-xl py-3 text-sm font-semibold">Annuleer</button>
              <button onClick={deleteEvent} className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold">Verwijder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
