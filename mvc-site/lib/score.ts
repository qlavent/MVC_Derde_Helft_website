import type { Match } from './types'

/**
 * Which scores a match has, in one place. Rendering lives in components/ScoreBlock.
 *
 * RBFA owns the official result for the season but publishes days late, so goals and corners
 * are tapped in during the match. Both are worth seeing, and it must always be obvious which
 * is which, so both are returned and labelled — not merged into one number.
 *
 *   not started        -> nothing at all
 *   started, no official -> the tally, counting 0-0 as a real result
 *   official, no tally   -> the official result only; a match nobody tracked is not claimed
 *                           to have finished 0-0 in the app
 *   both                 -> both, official first
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
  /** Counted from goals and corners entered in the app. */
  tally: Pair | null
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
): { pair: Pair; entered: boolean } {
  const ourGoals = goals.filter((g) => g.match_id === match.id)
  const ourCorners = corners.filter((c) => c.match_id === match.id)

  const ours =
    ourGoals.filter((g) => g.player_id !== null && !g.is_corner_goal).length +
    ourCorners.filter((c) => c.is_goal).length
  const theirs = ourGoals.filter((g) => g.player_id === null).length

  return {
    pair: match.is_home_game ? { home: ours, away: theirs } : { home: theirs, away: ours },
    entered: ourGoals.length > 0 || ourCorners.length > 0,
  }
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

  const { pair, entered } = countTally(match, goals, corners)
  // 0-0 is a real result, so an untracked match still shows a tally when that is the only
  // score there is. With an official result in hand, an empty tally is just noise.
  const tally = entered || !official ? pair : null

  if (!official && !tally) return null

  return {
    official,
    tally,
    differs: official !== null && tally !== null && (official.home !== tally.home || official.away !== tally.away),
  }
}
