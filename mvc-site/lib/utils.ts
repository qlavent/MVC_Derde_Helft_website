import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

// RBFA times are stored as Brussels local time but PostgreSQL treats them as UTC.
// This means displayed times appear 2h ahead. Fix: use UTC methods for display.
export function parseMatchDate(dateStr: string): Date {
  // Parse as UTC to get the original Brussels time back
  const d = new Date(dateStr)
  // Shift back by browser's UTC offset so format() shows the UTC value
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000)
}

export function formatMatchDate(dateStr: string, fmt: string): string {
  return format(parseMatchDate(dateStr), fmt, { locale: nl })
}
