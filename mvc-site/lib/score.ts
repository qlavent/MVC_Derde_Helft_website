import type { Match } from './types'

/**
 * Which score to show for a match, in one place.
 *
 * RBFA is the source of truth for the season, but it publishes results days late, which is
 * why goals and corners are tapped in during the match. So:
 *
 *   - official result available  -> that is the score
 *   - not yet available          -> the manual tally stands in
 *   - both available and equal   -> just the one number
 *   - both available and differ  -> show the manual tally alongside, because a mismatch is
 *                                   worth seeing rather than silently discarding
 *
 * A match with no goal or corner rows at all has no manual tally — deliberately not treated
 * as 0-0, since "nobody tracked it" and "it really was 0-0" are indistinguishable.
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

export interface MatchScore {
  home: number
  away: number
  /** 'official' = from RBFA, 'manual' = counted from goals and corners in the app. */
  source: 'official' | 'manual'
  /** The manual tally, only when an official result exists and disagrees with it. */
  disagrees: { home: number; away: number } | null
}

/**
 * Our goals: regular goals with a player, plus corners that were scored.
 * Opponent goals: goal rows with no player, which is how they are entered.
 * Mirrors the counting on the match page.
 */
export function manualTally(
  match: Pick<Match, 'id' | 'is_home_game'>,
  goals: GoalRow[],
  corners: CornerRow[]
): { home: number; away: number } | null {
  const ourGoals = goals.filter((g) => g.match_id === match.id)
  const ourCorners = corners.filter((c) => c.match_id === match.id)
  if (ourGoals.length === 0 && ourCorners.length === 0) return null

  const ours =
    ourGoals.filter((g) => g.player_id !== null && !g.is_corner_goal).length +
    ourCorners.filter((c) => c.is_goal).length
  const theirs = ourGoals.filter((g) => g.player_id === null).length

  return match.is_home_game ? { home: ours, away: theirs } : { home: theirs, away: ours }
}

export function scoreFor(
  match: Pick<Match, 'id' | 'is_home_game' | 'rbfa_home_score' | 'rbfa_away_score'>,
  goals: GoalRow[],
  corners: CornerRow[]
): MatchScore | null {
  const manual = manualTally(match, goals, corners)
  const hasOfficial = match.rbfa_home_score !== null && match.rbfa_away_score !== null

  if (hasOfficial) {
    const home = match.rbfa_home_score as number
    const away = match.rbfa_away_score as number
    const differs = manual !== null && (manual.home !== home || manual.away !== away)
    return { home, away, source: 'official', disagrees: differs ? manual : null }
  }

  if (manual) return { ...manual, source: 'manual', disagrees: null }
  return null
}
