'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { UclPrediction } from './PredictionRow'

/**
 * Decision 12: everyone's predictions are visible, but folded away behind a per-match
 * dropdown so the screen does not hand you the answer while you are still entering yours.
 * The RLS select policy already allows this read; the fold is presentation only.
 *
 * Names come from ucl_players. An e-mail address is never shown anywhere in this section —
 * a player without a row (deleted, or mid-signup) reads as "Onbekend".
 */
export default function OthersPanel({
  predictions,
  names,
  scored,
}: {
  /** Everyone else's predictions for this one match. */
  predictions: UclPrediction[]
  /** user_id -> display_name. */
  names: Map<string, string>
  /** True once the match has a result, which switches the sort to points. */
  scored: boolean
}) {
  const [open, setOpen] = useState(false)

  if (predictions.length === 0) {
    return (
      <p className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--subtle2)]">
        Nog geen voorspellingen van anderen
      </p>
    )
  }

  const nameOf = (userId: string) => names.get(userId) ?? 'Onbekend'

  // Scored: best first, so the panel reads as a mini scoreboard. Unscored there is nothing to
  // rank on, so alphabetical — stable, and it does not imply an order that isn't there.
  const rows = [...predictions].sort((a, b) =>
    scored
      ? (b.points ?? -1) - (a.points ?? -1) || nameOf(a.user_id).localeCompare(nameOf(b.user_id), 'nl')
      : nameOf(a.user_id).localeCompare(nameOf(b.user_id), 'nl')
  )

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-xs text-[var(--subtle)] py-1 active:opacity-70"
      >
        <span className="text-left">
          Voorspellingen van anderen ({predictions.length})
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((p) => (
            <li key={p.user_id} className="flex items-start justify-between gap-3 text-sm">
              {/* min-w-0 + break-words: long names wrap onto a second line, never truncate. */}
              <span className="min-w-0 break-words text-[var(--fg)]">{nameOf(p.user_id)}</span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="tabular text-[var(--subtle)]">
                  {p.home_goals} – {p.away_goals}
                </span>
                {scored && p.points != null && (
                  <span
                    className="tabular text-xs font-bold rounded-md px-1.5 py-0.5 bg-sand-20"
                    style={{ color: 'var(--sand)' }}
                  >
                    {p.points}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
