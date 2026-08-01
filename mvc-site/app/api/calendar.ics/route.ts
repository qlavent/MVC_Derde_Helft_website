import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import ical from 'ical-generator'

export async function GET(req: NextRequest) {
  const supabase = supabaseServer()
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('match')
  const eventId = searchParams.get('event')

  // No calendar-level timezone: with one set, ical-generator writes the UTC clock as a
  // *floating* time (DTSTART:20250901T170000, no Z, no TZID), which every client then reads
  // in the calendar's zone — 2 hours early. start_time is a true UTC instant, so emit it as
  // UTC (DTSTART:...Z) and let each client convert. Unambiguous on iOS, Google and Outlook.
  // ttl emits REFRESH-INTERVAL and X-PUBLISHED-TTL. Subscribed clients poll on their own
  // schedule (iOS minutes-to-hours, Google up to a day) and cannot be pushed to; Apple and
  // Outlook do at least treat this as a hint, so ask for hourly.
  const calendar = ical({ name: 'MVC Den Derde Helft', ttl: 60 * 60 })

  if (matchId) {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single()
    if (match) {
      calendar.createEvent({
        id: match.id,
        start: new Date(match.start_time),
        end: new Date(new Date(match.start_time).getTime() + 90 * 60 * 1000),
        summary: `${match.home_team_name} vs ${match.away_team_name}`,
        description: match.series_name ?? 'Minivoetbal kern Deinze',
        location: match.location_name ?? 'Kern Deinze',
      })
    }
  } else if (eventId) {
    const { data: ev } = await supabase.from('calendar_events').select('*').eq('id', eventId).single()
    if (ev) {
      calendar.createEvent({
        id: ev.id,
        start: new Date(ev.start_time),
        end: ev.end_time ? new Date(ev.end_time) : new Date(new Date(ev.start_time).getTime() + 60 * 60 * 1000),
        summary: ev.title,
        description: ev.description ?? undefined,
        location: ev.location ?? undefined,
      })
    }
  } else {
    // Full calendar feed
    const [{ data: matches }, { data: events }] = await Promise.all([
      supabase.from('matches').select('*').order('start_time'),
      supabase.from('calendar_events').select('*').eq('include_in_ical', true).order('start_time'),
    ])

    for (const m of matches ?? []) {
      calendar.createEvent({
        id: m.id,
        start: new Date(m.start_time),
        end: new Date(new Date(m.start_time).getTime() + 90 * 60 * 1000),
        summary: `⚽ ${m.home_team_name} vs ${m.away_team_name}`,
        description: m.series_name ?? 'Minivoetbal kern Deinze',
        location: m.location_name ?? 'Kern Deinze',
      })
    }

    for (const e of events ?? []) {
      calendar.createEvent({
        id: e.id,
        start: new Date(e.start_time),
        end: e.end_time ? new Date(e.end_time) : new Date(new Date(e.start_time).getTime() + 60 * 60 * 1000),
        summary: e.title,
        description: e.description ?? undefined,
        location: e.location ?? undefined,
      })
    }
  }

  return new NextResponse(calendar.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mvc-derde-helft.ics"',
      'Cache-Control': 'no-cache',
    },
  })
}
