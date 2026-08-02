import type { Match } from './types'

/**
 * Which scores a match has, in one place. Rendering lives in components/ScoreBlock.
 *
 * RBFA owns the official result for the season but publishes days late, so goals and corners
 * are tapped in during the match. Both are worth seeing, and it must always be obvious which
 * is which, so both are returned and labelled — not merged into one number.
 *
 *   not started -> nothing at all
 *   started     -> always both labels: RBFA once they publish, plus the unofficial tally,
 *                  which reads 0-0 when nothing was entered. 0-0 is a real result, so it is
 *                  shown rather than omitted.
 */

export interface GoalRow {
  match_id: string
  player_id: string | null
  is_corner_goal: boolean
}

export interface CornerRow {
  match_id: string
  is_goal: boolean
}

export interface Pair {
  home: number
  away: number
}

export interface ScoreView {
  /** RBFA's result, once they publish it. */
  official: Pair | null
  /** Counted from goals and corners entered in the app. 0-0 when nothing was entered. */
  tally: Pair
  /** True when both exist and disagree — worth pointing out rather than hiding. */
  differs: boolean
}

/**
 * Our goals: regular goals with a player, plus corners that were scored.
 * Opponent goals: goal rows with no player, which is how they are entered.
 */
function countTally(
  match: Pick<Match, 'id' | 'is_home_game'>,
  goals: GoalRow[],
  corners: CornerRow[]
): Pair {
  const ourGoals = goals.filter((g) => g.match_id === match.id)
  const ourCorners = corners.filter((c) => c.match_id === match.id)

  const ours =
    ourGoals.filter((g) => g.player_id !== null && !g.is_corner_goal).length +
    ourCorners.filter((c) => c.is_goal).length
  const theirs = ourGoals.filter((g) => g.player_id === null).length

  return match.is_home_game ? { home: ours, away: theirs } : { home: theirs, away: ours }
}

export function scoreView(
  match: Pick<Match, 'id' | 'is_home_game' | 'state' | 'rbfa_home_score' | 'rbfa_away_score'>,
  goals: GoalRow[],
  corners: CornerRow[]
): ScoreView | null {
  if (match.state === 'upcoming') return null

  const official =
    match.rbfa_home_score !== null && match.rbfa_away_score !== null
      ? { home: match.rbfa_home_score, away: match.rbfa_away_score }
      : null

  // A played match always has an unofficial score, 0-0 included.
  const tally = countTally(match, goals, corners)

  return {
    official,
    tally,
    differs: official !== null && (official.home !== tally.home || official.away !== tally.away),
  }
}
