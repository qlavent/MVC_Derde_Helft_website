'use client'

export type LeaderboardRow = {
  user_id: string
  display_name: string
  points: number
}

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * The standings table, shared by both Stand tabs (spec decision 7).
 *
 * Deliberately dumb: no fetching, no aggregation. The page decides what a row means — the
 * season tab passes one season's rows, the all-time tab passes the same rows summed per user —
 * so the two tabs cannot drift apart in here.
 *
 * Points only (spec decision 8). The view also has `predictions`, `scored` and `exact_hits`;
 * they exist for debugging and are deliberately not rendered.
 */
export default function LeaderboardTable({
  rows,
  currentUserId,
  emptyText = 'Nog geen punten. De stand vult zich na de eerste speeldag.',
}: {
  /** Already sorted highest-first by the caller. */
  rows: LeaderboardRow[]
  currentUserId: string | null
  emptyText?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="ucl-card p-6 text-center">
        <p className="text-sm text-[var(--subtle)] break-words">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="ucl-card overflow-hidden">
      <div className="flex items-center px-4 py-2 border-b border-[var(--border)] text-[10px] text-[var(--subtle)] uppercase tracking-wide">
        <span className="w-8">#</span>
        <span className="flex-1">Speler</span>
        <span className="w-12 text-right">Punten</span>
      </div>
      {rows.map((row, i) => {
        // Standard competition ranking: equal points share a place, so two leaders both get
        // the gold medal instead of one of them silently losing the tie to array order.
        const place = rows.findIndex(r => r.points === row.points) + 1
        const isMe = row.user_id === currentUserId
        return (
          <div
            key={row.user_id}
            className={`flex items-center px-4 py-3 border-b border-[var(--border)] last:border-0 ${isMe ? 'bg-sand-10' : ''}`}
          >
            <span className={`w-8 text-sm font-bold tabular ${isMe ? 'text-[var(--sand)]' : 'text-[var(--subtle)]'}`}>
              {place <= 3 ? MEDALS[place - 1] : `${place})`}
            </span>
            <span className={`flex-1 min-w-0 text-sm break-words leading-tight ${isMe ? 'font-bold text-[var(--sand)]' : ''}`}>
              {row.display_name || 'Onbekend'}
              {isMe && (
                <span className="ml-2 text-[10px] bg-[var(--sand)] text-[var(--sand-fg)] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Jij
                </span>
              )}
            </span>
            <span className={`w-12 text-right text-sm font-black tabular ${isMe ? 'text-[var(--sand)]' : ''}`}>
              {row.points}
            </span>
          </div>
        )
      })}
      <p className="px-4 py-2 text-[10px] text-[var(--subtle2)] border-t border-[var(--border)]">
        Exact 10 · doelsaldo 7 · winnaar 5 · anders 1
      </p>
    </div>
  )
}
