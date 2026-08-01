import Link from 'next/link'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { Match } from '@/lib/types'
import { toBrussels } from '@/lib/utils'
import { scoreFor, type GoalRow, type CornerRow } from '@/lib/score'

interface Props {
  match: Match
  showLink?: boolean
  isNext?: boolean
  /** Goal and corner rows so the manual tally can stand in before RBFA publishes. */
  goals?: GoalRow[]
  corners?: CornerRow[]
  /** Fluid padding that shrinks with viewport height. For the height-locked home screen;
   *  the scrolling lists keep fixed padding. */
  compact?: boolean
}

export default function MatchCard({ match, showLink = true, isNext = false, compact = false, goals = [], corners = [] }: Props) {
  const date = toBrussels(match.start_time)
  const score = scoreFor(match, goals, corners)

  const card = (
    <div className={`bg-[var(--surface)] rounded-2xl border transition-colors
      ${compact ? 'p-[var(--v-pad)]' : 'p-4'}
      ${isNext ? 'border-[var(--sand)]' : 'border-[var(--border)]'}
      ${showLink ? 'cursor-pointer hover:border-[var(--sand)]' : ''}
    `}>
      {/* Date row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--subtle)]">
          {format(date, 'EEEE d MMM yyyy', { locale: nl })}
        </span>
        <div className="flex items-center gap-1.5">
          {match.state === 'live' && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
          {isNext && match.state === 'upcoming' && (
            <span className="text-[10px] bg-[var(--sand)] text-[var(--sand-fg)] px-2 py-0.5 rounded-full font-semibold">
              Volgende
            </span>
          )}
          <span className="text-xs text-[var(--subtle)]">{format(date, 'HH:mm')}</span>
        </div>
      </div>

      {/* Teams + score */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm font-semibold flex-1 min-w-0 break-words leading-tight ${match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
          {match.home_team_name}
        </span>

        {score ? (
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg px-3 py-1">
              <span className="text-lg font-bold tabular-nums">{score.home}</span>
              <span className="text-[var(--subtle2)] mx-1">—</span>
              <span className="text-lg font-bold tabular-nums">{score.away}</span>
            </div>
            {score.disagrees && (
              <span className="text-[9px] text-[var(--subtle2)] mt-0.5 whitespace-nowrap">
                geteld {score.disagrees.home}–{score.disagrees.away}
              </span>
            )}
          </div>
        ) : (
          <div className="w-12 flex-shrink-0" />
        )}

        <span className={`text-sm font-semibold flex-1 min-w-0 text-right break-words leading-tight ${!match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
          {match.away_team_name}
        </span>
      </div>

      {(match.series_name || match.location_name) && (
        <p className="text-[10px] text-[var(--subtle2)] mt-1.5 break-words leading-snug">
          {[match.series_name, match.location_name].filter(Boolean).join(' • ')}
        </p>
      )}
    </div>
  )

  if (showLink) {
    return <Link href={`/wedstrijden/${match.id}`}>{card}</Link>
  }
  return card
}
