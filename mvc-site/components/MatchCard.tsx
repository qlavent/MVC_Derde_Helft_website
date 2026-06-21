import Link from 'next/link'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { Match } from '@/lib/types'

interface Props {
  match: Match
  showLink?: boolean
  isNext?: boolean
}

export default function MatchCard({ match, showLink = true, isNext = false }: Props) {
  const rawDate = new Date(match.start_time)
  const date = new Date(rawDate.getTime() + rawDate.getTimezoneOffset() * 60000)
  const homeScore = match.manual_home_score ?? match.rbfa_home_score
  const awayScore = match.manual_away_score ?? match.rbfa_away_score
  const hasScore = homeScore !== null && awayScore !== null

  const card = (
    <div className={`bg-[var(--surface)] rounded-2xl p-4 border transition-colors
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
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold flex-1 truncate ${match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
          {match.home_team_name}
        </span>

        {hasScore ? (
          <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg px-3 py-1 flex-shrink-0">
            <span className="text-lg font-bold tabular-nums">{homeScore}</span>
            <span className="text-[var(--subtle2)] mx-1">—</span>
            <span className="text-lg font-bold tabular-nums">{awayScore}</span>
          </div>
        ) : (
          <div className="w-12 flex-shrink-0" />
        )}

        <span className={`text-sm font-semibold flex-1 text-right truncate ${!match.is_home_game ? 'text-[var(--sand)]' : ''}`}>
          {match.away_team_name}
        </span>
      </div>

      {match.series_name && (
        <p className="text-[10px] text-[var(--subtle2)] mt-1.5">{match.series_name}</p>
      )}
    </div>
  )

  if (showLink) {
    return <Link href={`/wedstrijden/${match.id}`}>{card}</Link>
  }
  return card
}
