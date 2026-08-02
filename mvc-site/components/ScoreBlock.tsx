import type { ScoreView } from '@/lib/score'

/**
 * The score of a match, wherever it appears. One component so a card, the home feed, the
 * live banner and the match page cannot drift apart in size or wording.
 *
 * Both scores are always shown when both exist, each with its own label, because a viewer
 * has to be able to tell RBFA's result from the one counted in the app. The official result
 * is the larger of the two; the tally sits under it, quieter.
 */

const SIZES = {
  card: { number: 'text-lg', label: 'text-[9px]', second: 'text-[11px]', gap: 'gap-0.5' },
  hero: { number: 'text-3xl', label: 'text-[10px]', second: 'text-base', gap: 'gap-1' },
} as const

export default function ScoreBlock({
  score,
  size = 'card',
  onDark = false,
}: {
  score: ScoreView
  size?: keyof typeof SIZES
  /** For the live banner, which sits on a red gradient. */
  onDark?: boolean
}) {
  const s = SIZES[size]
  const numberColour = onDark ? 'text-white' : ''
  const labelColour = onDark ? 'text-white/60' : 'text-[var(--subtle)]'
  const secondColour = onDark ? 'text-white/75' : 'text-[var(--subtle)]'
  const dashColour = onDark ? 'text-white/40' : 'text-[var(--subtle2)]'

  // The prominent line: RBFA when they have published, otherwise the tally is all there is.
  const lead = score.official ?? score.tally
  const leadLabel = score.official ? 'RBFA' : 'Geteld'
  if (!lead) return null

  return (
    <div className={`flex flex-col items-center ${s.gap} flex-shrink-0`}>
      <span className={`${s.label} uppercase tracking-widest ${labelColour} leading-none`}>
        {leadLabel}
      </span>

      <div
        className={`flex items-center gap-1 rounded-lg px-3 py-1 ${
          onDark ? 'bg-black/30' : 'bg-[var(--muted)]'
        }`}
      >
        <span className={`${s.number} font-bold tabular-nums ${numberColour}`}>{lead.home}</span>
        <span className={`${dashColour} mx-0.5`}>—</span>
        <span className={`${s.number} font-bold tabular-nums ${numberColour}`}>{lead.away}</span>
      </div>

      {/* Only when RBFA is the lead is there a second line to show. */}
      {score.official && score.tally && (
        <span className={`${s.second} tabular-nums ${secondColour} leading-none whitespace-nowrap`}>
          <span className={`${s.label} uppercase tracking-widest ${labelColour}`}>Geteld </span>
          {score.tally.home}–{score.tally.away}
        </span>
      )}
    </div>
  )
}
