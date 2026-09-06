'use client'

import { formatBrussels } from '@/lib/utils'

export type ResultMatch = {
  id: number
  home_team: string
  away_team: string
  home_crest: string | null
  away_crest: string | null
  home_score: number | null
  away_score: number | null
  utc_kickoff: string
}

export type ResultPrediction = {
  user_id: string
  match_id: number
  home_goals: number
  away_goals: number
  /** null = the sync has not scored this one yet. Never render that as a zero. */
  points: number | null
}

/** Crests are nullable and point at a third-party CDN, so a dead URL must not leave a gap. */
function Crest({ src }: { src: string | null }) {
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-6 h-6 object-contain flex-shrink-0"
      onError={e => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

/**
 * One finished match: the real score, then what everybody predicted and what it earned.
 *
 * Dumb like LeaderboardTable — the page fetches, this only renders. `names` maps user_id to
 * display_name; an email address must never reach the screen, so a user we have no
 * ucl_players row for falls back to "Onbekend" rather than to anything from auth.
 */
export default function MatchResultCard({
  match,
  predictions,
  names,
  currentUserId,
}: {
  match: ResultMatch
  /** Every player's prediction for this match, in any order. */
  predictions: ResultPrediction[]
  names: Record<string, string>
  currentUserId: string | null
}) {
  // Best first; unscored rows sink to the bottom, because null is "unknown", not "zero".
  const sorted = [...predictions].sort((a, b) => {
    if (a.points === null && b.points === null) return 0
    if (a.points === null) return 1
    if (b.points === null) return -1
    return b.points - a.points
  })

  return (
    <div className="ucl-card p-4 mb-3">
      <p className="text-[10px] text-[var(--subtle)] mb-2">
        {formatBrussels(match.utc_kickoff, 'EEE d MMM · HH:mm')}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
          <span className="text-sm font-semibold break-words leading-tight">{match.home_team}</span>
          <Crest src={match.home_crest} />
        </div>
        <span className="text-lg font-black tabular px-2 whitespace-nowrap">
          {match.home_score ?? '–'} - {match.away_score ?? '–'}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Crest src={match.away_crest} />
          <span className="text-sm font-semibold break-words leading-tight">{match.away_team}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        {sorted.length === 0 ? (
          <p className="text-xs text-[var(--subtle)]">Niemand heeft deze wedstrijd voorspeld.</p>
        ) : (
          sorted.map(p => {
            const isMe = p.user_id === currentUserId
            return (
              <div
                key={p.user_id}
                className={`flex items-center gap-2 py-1.5 rounded-lg ${isMe ? 'bg-sand-10 px-2 -mx-2' : ''}`}
              >
                <span className={`flex-1 min-w-0 text-sm break-words leading-tight ${isMe ? 'font-bold text-[var(--sand)]' : ''}`}>
                  {names[p.user_id] || 'Onbekend'}
                </span>
                <span className="text-sm tabular text-[var(--subtle)] whitespace-nowrap">
                  {p.home_goals} - {p.away_goals}
                </span>
                {p.points === null ? (
                  <span className="text-[10px] text-[var(--subtle2)] whitespace-nowrap w-20 text-right">
                    nog niet gescoord
                  </span>
                ) : (
                  <span
                    className="text-xs font-black tabular whitespace-nowrap w-20 text-right"
                    style={{ color: p.points >= 10 ? 'var(--olive)' : 'var(--fg)' }}
                  >
                    +{p.points}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
