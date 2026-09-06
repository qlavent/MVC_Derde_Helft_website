// Smallest runnable check for the prediction game rules.  node scripts/check-ucl.mjs
import assert from 'node:assert/strict'
import { pointsFor, isOpen, POINTS } from '../lib/ucl/score.mjs'

// exact
assert.equal(pointsFor(2, 1, 2, 1), POINTS.EXACT)
assert.equal(pointsFor(0, 0, 0, 0), POINTS.EXACT)

// same goal difference, different scoreline
assert.equal(pointsFor(3, 1, 2, 0), POINTS.GOAL_DIFF)
// a draw predicted as a different draw is a goal-difference hit, not merely "winner"
assert.equal(pointsFor(1, 1, 2, 2), POINTS.GOAL_DIFF)

// right winner, wrong margin
assert.equal(pointsFor(3, 0, 1, 0), POINTS.WINNER)
assert.equal(pointsFor(0, 2, 1, 3), POINTS.GOAL_DIFF) // -2 both, so difference wins
assert.equal(pointsFor(0, 3, 0, 1), POINTS.WINNER)

// wrong outcome
assert.equal(pointsFor(2, 0, 0, 1), POINTS.PLAYED)
assert.equal(pointsFor(1, 1, 2, 0), POINTS.PLAYED)   // draw vs home win
assert.equal(pointsFor(2, 0, 1, 1), POINTS.PLAYED)   // home win vs draw

// no result yet is not zero, it is "not scored"
assert.equal(pointsFor(null, null, 1, 0), null)
assert.equal(pointsFor(1, 0, null, null), null)

// the kickoff lock
const future = new Date(Date.now() + 3600_000).toISOString()
const past = new Date(Date.now() - 60_000).toISOString()
assert.equal(isOpen({ utc_kickoff: future, status: 'TIMED' }), true)
assert.equal(isOpen({ utc_kickoff: future, status: 'SCHEDULED' }), true)
assert.equal(isOpen({ utc_kickoff: past, status: 'TIMED' }), false, 'kickoff passed')
assert.equal(isOpen({ utc_kickoff: future, status: 'IN_PLAY' }), false, 'already started')
assert.equal(isOpen({ utc_kickoff: future, status: 'FINISHED' }), false)
assert.equal(isOpen(null), false)

console.log('ok — scoring table and kickoff lock behave')

// --- current matchday selection -------------------------------------------------
import { currentMatchday } from '../lib/ucl/api.mjs'

const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString()
const rows = [
  { id: 1, stage: 'LEAGUE_STAGE', matchday: 1, status: 'FINISHED', utc_kickoff: iso(-200) },
  { id: 2, stage: 'LEAGUE_STAGE', matchday: 2, status: 'FINISHED', utc_kickoff: iso(-50) },
  { id: 3, stage: 'LEAGUE_STAGE', matchday: 2, status: 'TIMED',    utc_kickoff: iso(2) },
  { id: 4, stage: 'LEAGUE_STAGE', matchday: 2, status: 'TIMED',    utc_kickoff: iso(4) },
  { id: 5, stage: 'LEAGUE_STAGE', matchday: 3, status: 'SCHEDULED', utc_kickoff: iso(200) },
]
const md = currentMatchday(rows)
assert.equal(md.matchday, 2, 'anchors on the earliest unfinished match')
assert.deepEqual(md.matches.map((m) => m.id), [2, 3, 4], 'includes the whole matchday, played ones too')

// mid-matchday: some already kicked off, the rest still open
const live = currentMatchday([
  { id: 6, stage: 'LEAGUE_STAGE', matchday: 4, status: 'IN_PLAY',   utc_kickoff: iso(-1) },
  { id: 7, stage: 'LEAGUE_STAGE', matchday: 4, status: 'TIMED',     utc_kickoff: iso(1) },
])
assert.equal(live.matchday, 4)
assert.deepEqual(live.matches.map((m) => m.id), [6, 7])

// everything finished: fall back to the last one rather than returning nothing
const done = currentMatchday([
  { id: 8, stage: 'FINAL', matchday: null, status: 'FINISHED', utc_kickoff: iso(-10) },
])
assert.equal(done.matches.length, 1)

assert.deepEqual(currentMatchday([]).matches, [])

console.log('ok — matchday selection is deterministic')

// --- round labels, shared by three screens ---------------------------------------
import { matchdayLabel, isLeagueStage } from '../lib/ucl/labels.mjs'

assert.equal(matchdayLabel('LEAGUE_STAGE', 3), 'Speeldag 3')
assert.equal(matchdayLabel('GROUP_STAGE', 6), 'Speeldag 6', 'the pre-2024 format still reads right')
assert.equal(matchdayLabel('LEAGUE_STAGE', null), 'Competitiefase')

// two-legged ties must be distinguishable, or a picker lists the round twice
assert.equal(matchdayLabel('QUARTER_FINALS', 1), 'Kwartfinales — heen')
assert.equal(matchdayLabel('QUARTER_FINALS', 2), 'Kwartfinales — terug')
assert.equal(matchdayLabel('QUARTER_FINALS', null), 'Kwartfinales')

// the same round under either vocabulary must produce the same Dutch
assert.equal(matchdayLabel('LAST_16', null), matchdayLabel('ROUND_OF_16', null))
assert.equal(matchdayLabel('PLAYOFFS', null), matchdayLabel('PLAY_OFF_ROUND', null))
assert.equal(matchdayLabel('FINAL', null), 'Finale')

// unknown input degrades to words, never SCREAMING_SNAKE and never a crash
assert.equal(matchdayLabel('SOME_NEW_ROUND', null), 'Some new round')
assert.equal(matchdayLabel(null, null), 'Wedstrijden')
assert.equal(matchdayLabel(null, 4), 'Speeldag 4')

assert.equal(isLeagueStage('LEAGUE_STAGE'), true)
assert.equal(isLeagueStage('FINAL'), false)

console.log('ok — round labels are consistent across screens')
