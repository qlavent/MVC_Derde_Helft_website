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
  card: { number: 'text-lg', label: 'text-[9px]', second: 'text-sm', gap: 'gap-0.5' },
  hero: { number: 'text-3xl', label: 'text-[10px]', second: 'text-lg', gap: 'gap-1' },
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
  const leadLabel = score.official ? 'RBFA' : 'Onofficieel'
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

      {/* Only when RBFA is the lead is there a second score to show. Same shape as the
          first — label, then number — so neither can be read as belonging to the other. */}
      {score.official && score.tally && (
        <div className={`flex flex-col items-center ${s.gap} mt-1`}>
          <span className={`${s.label} uppercase tracking-widest ${labelColour} leading-none`}>
            Onofficieel
          </span>
          <span className={`${s.second} font-semibold tabular-nums ${secondColour} leading-none whitespace-nowrap`}>
            {score.tally.home}–{score.tally.away}
          </span>
        </div>
      )}
    </div>
  )
}
