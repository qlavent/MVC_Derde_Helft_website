'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUclSession } from '@/lib/ucl/session'
import { isOpen } from '@/lib/ucl/score.mjs'

/**
 * Decision 13: the in-app reminder is a count, nothing else — no push, no mail.
 *
 * The dock renders it as a badge on Wedstrijden, so this hook is mounted on every screen in
 * the section. It is therefore two narrow queries, not a full page load: only the columns
 * isOpen() needs, and only the match ids this player already predicted.
 */

/** Fired after a prediction is written, so the dock badge does not sit stale while you play. */
export const PREDICTIONS_CHANGED = 'ucl:predictions-changed'

export function notifyPredictionsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREDICTIONS_CHANGED))
}

/**
 * How many still-open matches this player has no prediction for. 0 when logged out.
 *
 * "Open" is `isOpen()` from score.mjs, the same test the steppers and the RLS policies use,
 * so the badge can never count a match you are no longer allowed to predict. The database
 * filter is deliberately looser than isOpen() (status plus kickoff, no clock skew handling);
 * isOpen() then re-checks every row against the browser's clock.
 */
export function useMissingCount(): number {
  const { session } = useUclSession()
  const userId = session?.user?.id ?? null
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    if (!userId) return 0
    const [{ data: matches }, { data: predictions }] = await Promise.all([
      supabase
        .from('ucl_matches')
        .select('id, utc_kickoff, status')
        .in('status', ['SCHEDULED', 'TIMED'])
        .gt('utc_kickoff', new Date().toISOString()),
      supabase.from('ucl_predictions').select('match_id').eq('user_id', userId),
    ])
    const done = new Set((predictions ?? []).map((p) => p.match_id))
    return (matches ?? []).filter((m) => isOpen(m) && !done.has(m.id)).length
  }, [userId])

  useEffect(() => {
    let alive = true
    const run = () => {
      void load().then((n) => {
        if (alive) setCount(n)
      })
    }
    run()
    window.addEventListener(PREDICTIONS_CHANGED, run)
    return () => {
      alive = false
      window.removeEventListener(PREDICTIONS_CHANGED, run)
    }
  }, [load])

  return count
}

export default useMissingCount
