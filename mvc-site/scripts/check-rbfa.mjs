// Smallest thing that fails if the RBFA layer breaks.  Run:  node scripts/check-rbfa.mjs
// Hits the live RBFA API, so it also tells you when RBFA changes something on their side.
import assert from 'node:assert/strict'
import { CLUB_ID, currentTeamIds, deriveState, inLiveWindow, rbfaQuery, seasonOf } from '../lib/rbfa.mjs'
import { brusselsToUtc, brusselsWallClock, brusselsFormToUtcIso } from '../lib/time.mjs'

// Seasons run August -> July.
assert.equal(seasonOf('2026-09-09T21:00:00'), '2026-2027')
assert.equal(seasonOf('2027-04-07T22:00:00'), '2026-2027')
assert.equal(seasonOf('2026-07-31T12:00:00'), '2025-2026')

// A naive RBFA time is Brussels wall-clock, not UTC: 21:00 CEST == 19:00Z.
assert.equal(brusselsToUtc('2026-09-09T21:00:00').toISOString(), '2026-09-09T19:00:00.000Z')
assert.equal(brusselsToUtc('2027-01-11T22:00:00').toISOString(), '2027-01-11T21:00:00.000Z') // CET

// Store UTC, display Brussels: a stored instant formats back to the same wall clock, on
// both sides of the DST change. This is what the display helpers rely on.
// Read the LOCAL fields, which is what date-fns format() does — brusselsWallClock returns
// a Date whose local fields spell out the Brussels wall clock. Calling .toISOString() on it
// would just undo the shift.
const pad = n => String(n).padStart(2, '0')
const wallOf = value => {
  const d = brusselsWallClock(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
assert.equal(wallOf('2026-09-09T19:00:00Z'), '2026-09-09T21:00') // CEST, +2
assert.equal(wallOf('2027-01-11T21:00:00Z'), '2027-01-11T22:00') // CET, +1

// Form input is Brussels wall clock → UTC, and survives the round trip.
assert.equal(brusselsFormToUtcIso('2026-09-09', '21:00'), '2026-09-09T19:00:00.000Z')
assert.equal(brusselsFormToUtcIso('2027-01-11', '22:00'), '2027-01-11T21:00:00.000Z')
assert.equal(brusselsFormToUtcIso('2026-06-08', '05:00'), '2026-06-08T03:00:00.000Z')
assert.equal(wallOf(brusselsFormToUtcIso('2026-12-25', '18:30')), '2026-12-25T18:30')

// Season boundaries follow the Brussels calendar.
assert.equal(seasonOf('2026-07-31T23:00:00Z'), '2026-2027') // 01:00 Aug 1 in Brussels
assert.equal(seasonOf('2026-07-31T21:00:00Z'), '2025-2026') // 23:00 Jul 31 in Brussels

// State falls back to the clock, because RBFA leaves played matches on 'planned'.
const kickoff = brusselsToUtc('2026-09-09T21:00:00')
const at = (ms) => new Date(kickoff.getTime() + ms)
// RBFA sends outcome: { homeTeamGoals: null, ... } for matches that have not been played,
// so an "outcome is present" check would mark the whole new season finished. It did.
const planned = { state: 'planned', startTime: '2026-09-09T21:00:00', outcome: { homeTeamGoals: null, awayTeamGoals: null } }
assert.equal(deriveState(planned, at(-3600000)), 'upcoming')
assert.equal(deriveState(planned, at(60000)), 'live')
assert.equal(deriveState(planned, at(5 * 3600000)), 'finished')
assert.equal(deriveState({ ...planned, outcome: { homeTeamGoals: 1, awayTeamGoals: 2 } }, at(-3600000)), 'finished')
assert.equal(inLiveWindow('2026-09-09T21:00:00', at(3600000)), true)
assert.equal(inLiveWindow('2026-09-09T21:00:00', at(9 * 3600000)), false)

// RBFA mints a new teamId every season; the clubId is stable. This is the bug that made
// the 2026-27 calendar invisible, so assert the club still resolves to a live calendar.
const teamIds = await currentTeamIds()
assert.ok(teamIds.length > 0, `clubTeams(${CLUB_ID}) returned no teams`)

const cal = await rbfaQuery(
  `query { teamCalendar(teamId: "${teamIds[0]}", language: nl, sortByDate: asc) { id startTime state } }`
)
assert.ok((cal.teamCalendar ?? []).length > 0, `teamCalendar(${teamIds[0]}) is empty — new season not published yet?`)

console.log(`ok — club ${CLUB_ID} -> teams ${teamIds.join(', ')}, ${cal.teamCalendar.length} matches`)
