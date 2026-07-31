// Time rules for this app, in one place:
//
//   STORE   — always a true UTC instant (timestamptz).
//   DISPLAY — always Europe/Brussels, whatever timezone the viewer's device is in.
//   INPUT   — whatever someone types in a form is Brussels wall-clock time.
//
// Plain .mjs so both the TypeScript app and `node scripts/check-rbfa.mjs` can import it.
//
// Why the toLocaleString('sv-SE') dance: it is the one dependency-free way to ask
// "what does the clock in Brussels read at this instant" — sv-SE formats as
// "2026-09-09 21:00:00", which is ISO apart from the space. Intl knows the DST rules,
// so this stays correct across the March/October changes without a table of offsets.

const TZ = 'Europe/Brussels'

function wallClockString(instant) {
  return instant.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T')
}

// A Brussels wall-clock time (no zone, e.g. "2026-09-09T21:00:00" — what RBFA sends and
// what a form field means) → the real UTC instant.
//
// Measures the Brussels offset at roughly the right moment and subtracts it. Within the
// one ambiguous hour when the clocks go back, either reading is defensible; matches and
// events are never scheduled there.
export function brusselsToUtc(wallClock) {
  const naive = String(wallClock).replace(/(Z|[+-]\d\d:?\d\d)$/, '')
  const asIfUtc = new Date(`${naive}Z`)
  if (Number.isNaN(asIfUtc.getTime())) return null
  const shifted = new Date(`${wallClockString(asIfUtc)}Z`)
  return new Date(asIfUtc.getTime() - (shifted.getTime() - asIfUtc.getTime()))
}

// A stored instant → a Date whose *local* fields read as Brussels time, so date-fns
// format() (which always formats in the runtime's zone) prints Brussels time on a phone
// set to any timezone. Only ever use the result for formatting, never for arithmetic.
export function brusselsWallClock(instant) {
  const d = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(d.getTime())) return d
  return new Date(wallClockString(d))
}

// Season label for an instant, by the Brussels calendar: August through July.
export function seasonOf(instant) {
  const d = brusselsWallClock(instant)
  const startYear = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${startYear}-${startYear + 1}`
}

// Form fields ("2026-09-09", "21:00") → UTC ISO string ready to store. Empty time = midnight.
export function brusselsFormToUtcIso(date, time) {
  const instant = brusselsToUtc(`${date}T${time || '00:00'}:00`)
  return instant ? instant.toISOString() : null
}
