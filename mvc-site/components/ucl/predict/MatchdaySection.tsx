'use client'

import { ChevronDown } from 'lucide-react'
import { isOpen } from '@/lib/ucl/score.mjs'
import PredictionRow from './PredictionRow'
import type { UclMatch, UclPrediction } from './PredictionRow'

/**
 * One collapsible matchday (decision 5: every future matchday is predictable, grouped by
 * matchday, and only the nearest one starts open — the caller decides which that is).
 *
 * The header carries the count of matches you still have to fill in for this matchday, so a
 * collapsed section still tells you whether there is work behind it.
 */
export default function MatchdaySection({
  label,
  matches,
  predictions,
  names,
  userId,
  open,
  onToggle,
}: {
  label: string
  /** Every match of this matchday, kickoff order, finished ones included. */
  matches: UclMatch[]
  /** Every prediction for these matches, everyone's (decision 12). */
  predictions: UclPrediction[]
  names: Map<string, string>
  userId: string
  open: boolean
  onToggle: () => void
}) {
  const minePerMatch = new Map(
    predictions.filter((p) => p.user_id === userId).map((p) => [p.match_id, p])
  )
  const missing = matches.filter((m) => isOpen(m) && !minePerMatch.has(m.id)).length

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 py-2 text-left active:opacity-70"
      >
        <ChevronDown
          size={16}
          className="flex-shrink-0 transition-transform text-[var(--subtle)]"
          style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
        />
        <span className="ucl-rule text-sm font-bold min-w-0 break-words">{label}</span>
        <span className="ml-auto flex items-center gap-2 flex-shrink-0">
          {missing > 0 && (
            <span
              className="tabular text-[10px] font-bold rounded-full px-2 py-0.5 bg-sand-20"
              style={{ color: 'var(--sand)' }}
            >
              {missing} te doen
            </span>
          )}
          <span className="tabular text-xs text-[var(--subtle2)]">{matches.length}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-3 mt-1">
          {matches.map((m) => (
            <PredictionRow
              key={m.id}
              match={m}
              userId={userId}
              mine={minePerMatch.get(m.id) ?? null}
              others={predictions.filter((p) => p.match_id === m.id && p.user_id !== userId)}
              names={names}
            />
          ))}
        </div>
      )}
    </section>
  )
}
