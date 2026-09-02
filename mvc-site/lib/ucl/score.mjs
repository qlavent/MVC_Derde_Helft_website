// Scoring for the Champions League prediction game.
//
// Same table as the Discord bot, so results stay comparable:
//
//   exact score            10
//   correct goal difference 7
//   correct winner          5
//   anything else           1
//
// Plain .mjs so both the app and scripts/check-ucl.mjs import the same code.

export const POINTS = { EXACT: 10, GOAL_DIFF: 7, WINNER: 5, PLAYED: 1 }

/**
 * Points for one prediction against a final score.
 * Returns null when the match has no result yet — callers must not treat that as zero.
 */
export function pointsFor(actualHome, actualAway, predHome, predAway) {
  if (actualHome == null || actualAway == null) return null
  if (predHome == null || predAway == null) return null

  if (actualHome === predHome && actualAway === predAway) return POINTS.EXACT
  if (actualHome - actualAway === predHome - predAway) return POINTS.GOAL_DIFF

  const actualWinner = Math.sign(actualHome - actualAway)
  const predWinner = Math.sign(predHome - predAway)
  // sign 0 means a draw, which the goal-difference branch above already caught, so reaching
  // here with equal signs means both picked the same winner but a different margin.
  if (actualWinner === predWinner) return POINTS.WINNER

  return POINTS.PLAYED
}

/** A prediction can only be entered or changed while the match has not kicked off. */
export function isOpen(match, now = new Date()) {
  if (!match?.utc_kickoff) return false
  if (!['SCHEDULED', 'TIMED'].includes(match.status)) return false
  return new Date(match.utc_kickoff).getTime() > now.getTime()
}
