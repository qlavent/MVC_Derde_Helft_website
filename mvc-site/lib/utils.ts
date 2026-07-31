import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { brusselsWallClock, brusselsFormToUtcIso, seasonOf } from './time.mjs'

export { brusselsFormToUtcIso, seasonOf }

// Stored values are true UTC instants; everything on screen is Brussels time. Use these
// for any timestamp on screen — never `new Date(value)` straight into format(), which
// renders in the viewer's device timezone. See lib/time.mjs for the rules.
export function toBrussels(value: string | Date): Date {
  return brusselsWallClock(value)
}

export function formatBrussels(value: string | Date, fmt: string): string {
  return format(brusselsWallClock(value), fmt, { locale: nl })
}
