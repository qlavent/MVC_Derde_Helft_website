'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Lock, Minus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatBrussels } from '@/lib/utils'
import { isOpen } from '@/lib/ucl/score.mjs'
import { notifyPredictionsChanged } from '@/lib/ucl/useMissingCount'
import OthersPanel from './OthersPanel'

/** A row of ucl_matches, as this screen reads it. */
export type UclMatch = {
  id: number
  season: string | null
  stage: string | null
  matchday: number | null
  utc_kickoff: string
  home_team: string
  away_team: string
  home_crest: string | null
  away_crest: string | null
  status: string
  home_score: number | null
  away_score: number | null
}

/** A row of ucl_predictions. `points` is null until the sync scores it. */
export type UclPrediction = {
  user_id: string
  match_id: number
  home_goals: number
  away_goals: number
  points: number | null
}

/** The column CHECK is `between 0 and 20`; the steppers must not offer what it rejects. */
const MIN_GOALS = 0
const MAX_GOALS = 20

/** Debounce for the autosave (decision 3): long enough to swallow a burst of taps. */
const SAVE_DELAY = 600

type Value = { h: number; a: number }
type Status = 'idle' | 'saving' | 'saved'

export default function PredictionRow({
  match,
  mine,
  others,
  names,
  userId,
}: {
  match: UclMatch
  /** This player's prediction, or null when they have not entered one. */
  mine: UclPrediction | null
  /** Everyone else's for this match (decision 12). */
  others: UclPrediction[]
  names: Map<string, string>
  userId: string
}) {
  const initial: Value = { h: mine?.home_goals ?? 0, a: mine?.away_goals ?? 0 }
  const [value, setValue] = useState<Value>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  // Set when the database refuses the write because kickoff passed while this tab sat open.
  // The clock check below cannot catch that on its own: this tab's clock may lag the server's.
  const [lateLock, setLateLock] = useState(false)
  // A saved 0–0 is a real prediction, so "nothing entered yet" cannot be read off the value.
  const [entered, setEntered] = useState(mine != null)

  // The last value the database accepted. A failed write reverts to it, and because the
  // autosave effect below compares against it, that revert cannot itself trigger a save.
  const committed = useRef<Value>(initial)
  // Guards against an older in-flight write landing after a newer one.
  const seq = useRef(0)

  const finished = match.status === 'FINISHED'
  const hasScore = match.home_score != null && match.away_score != null
  const locked = lateLock || !isOpen(match)

  const save = useCallback(
    async (next: Value) => {
      const ticket = ++seq.current
      setStatus('saving')
      setError(null)
      // NEVER send `points`: the ucl_predictions guard trigger raises a hard error on any
      // player-supplied value, including echoing back the one the server itself awarded.
      const { error: writeError } = await supabase.from('ucl_predictions').upsert(
        {
          user_id: userId,
          match_id: match.id,
          home_goals: next.h,
          away_goals: next.a,
        },
        { onConflict: 'user_id,match_id' }
      )
      if (seq.current !== ticket) return // superseded by a newer save

      if (writeError) {
        setStatus('idle')
        if (writeError.code === '42501') {
          // RLS refused it: the kickoff lock in the insert/update policies. The tab was open
          // too long, so lock the row rather than offering a control that will fail again.
          setLateLock(true)
          setError('De aftrap is intussen geweest. Je voorspelling kon niet meer opgeslagen worden.')
        } else {
          setError(`Opslaan lukte niet: ${writeError.message}`)
        }
        setValue(committed.current)
        return
      }

      committed.current = next
      setEntered(true)
      setStatus('saved')
      notifyPredictionsChanged()
    },
    [match.id, userId]
  )

  useEffect(() => {
    if (value.h === committed.current.h && value.a === committed.current.a) return
    const t = setTimeout(() => void save(value), SAVE_DELAY)
    return () => clearTimeout(t)
  }, [value, save])

  // Let the tick fade out on its own; it is confirmation, not a thing to dismiss.
  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => setStatus('idle'), 1800)
    return () => clearTimeout(t)
  }, [status])

  const bump = (side: 'h' | 'a', delta: number) =>
    setValue((v) => ({
      ...v,
      [side]: Math.min(MAX_GOALS, Math.max(MIN_GOALS, v[side] + delta)),
    }))

  return (
    <div className="ucl-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs text-[var(--subtle)]">
          {formatBrussels(match.utc_kickoff, "EEE d MMM 'om' HH:mm")}
        </span>
        <StatusChip match={match} locked={locked} finished={finished} />
      </div>

      <TeamRow
        name={match.home_team}
        crest={match.home_crest}
        goals={value.h}
        actual={match.home_score}
        showActual={hasScore}
        locked={locked}
        entered={entered}
        onBump={(d) => bump('h', d)}
      />
      <TeamRow
        name={match.away_team}
        crest={match.away_crest}
        goals={value.a}
        actual={match.away_score}
        showActual={hasScore}
        locked={locked}
        entered={entered}
        onBump={(d) => bump('a', d)}
      />

      {hasScore && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--subtle)]">
            {finished ? 'Uitslag' : 'Tussenstand'}{' '}
            <span className="tabular text-[var(--fg)] font-bold">
              {match.home_score} – {match.away_score}
            </span>
          </span>
          {mine == null ? (
            <span className="text-xs text-[var(--subtle2)]">Geen voorspelling</span>
          ) : mine.points != null ? (
            <span
              className="tabular text-xs font-bold rounded-md px-2 py-1 bg-sand-20"
              style={{ color: 'var(--sand)' }}
            >
              +{mine.points} punten
            </span>
          ) : (
            <span className="text-xs text-[var(--subtle2)]">Nog niet gescoord</span>
          )}
        </div>
      )}

      {/* Kept mounted so it fades rather than vanishes (decision 3: a brief tick). */}
      <div
        className="mt-2 h-4 flex items-center gap-1.5 text-xs transition-opacity duration-500"
        style={{ opacity: status === 'idle' ? 0 : 1, color: 'var(--olive)' }}
        aria-live="polite"
      >
        {status === 'saved' && (
          <>
            <Check size={12} />
            <span>opgeslagen</span>
          </>
        )}
        {status === 'saving' && <span className="text-[var(--subtle)]">opslaan…</span>}
      </div>

      {error && <p className="text-xs text-red-400 leading-relaxed mt-1">{error}</p>}

      {!hasScore && !locked && !entered && status === 'idle' && (
        <p className="text-xs text-[var(--subtle2)] mt-1">
          Nog niets ingevuld — tik op + of − om je voorspelling te zetten.
        </p>
      )}

      <OthersPanel predictions={others} names={names} scored={finished} />
    </div>
  )
}

/** Why the row is not editable, in one short Dutch label. */
function StatusChip({
  match,
  locked,
  finished,
}: {
  match: UclMatch
  locked: boolean
  finished: boolean
}) {
  if (finished) return <Chip>Gespeeld</Chip>
  if (match.status === 'IN_PLAY' || match.status === 'PAUSED')
    return (
      <Chip accent>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle animate-pulse"
          style={{ background: 'var(--sand)' }}
        />
        {match.status === 'PAUSED' ? 'Rust' : 'Live'}
      </Chip>
    )
  if (locked)
    return (
      <Chip>
        <Lock size={10} className="inline-block mr-1 -mt-0.5" />
        Gesloten
      </Chip>
    )
  return null
}

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`text-[10px] font-semibold rounded-md px-1.5 py-0.5 flex-shrink-0 ${accent ? 'bg-sand-20' : ''}`}
      style={{
        color: accent ? 'var(--sand)' : 'var(--subtle)',
        background: accent ? undefined : 'var(--muted)',
      }}
    >
      {children}
    </span>
  )
}

function TeamRow({
  name,
  crest,
  goals,
  actual,
  showActual,
  locked,
  entered,
  onBump,
}: {
  name: string
  crest: string | null
  goals: number
  actual: number | null
  showActual: boolean
  locked: boolean
  /** False when this player never entered a prediction — a locked 0 would otherwise read as one. */
  entered: boolean
  onBump: (delta: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {crest && (
          // A dead crest URL must not collapse or reflow the row: the box keeps its size and
          // the broken image just stops painting.
          <img
            src={crest}
            alt=""
            width={22}
            height={22}
            className="w-[22px] h-[22px] object-contain flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        )}
        {/* break-words, not truncate: long club names wrap. */}
        <span className="text-sm font-semibold min-w-0 break-words leading-snug">{name}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {showActual && <span className="tabular text-sm text-[var(--subtle)]">{actual}</span>}
        {locked ? (
          <span
            className="tabular text-lg font-bold w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--muted)', color: 'var(--subtle)' }}
          >
            {entered ? goals : '–'}
          </span>
        ) : (
          <>
            <StepButton label="Eén doelpunt minder" disabled={goals <= MIN_GOALS} onClick={() => onBump(-1)}>
              <Minus size={16} />
            </StepButton>
            <span className="tabular w-6 text-center text-lg font-bold">{goals}</span>
            <StepButton label="Eén doelpunt meer" disabled={goals >= MAX_GOALS} onClick={() => onBump(1)}>
              <Plus size={16} />
            </StepButton>
          </>
        )}
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--muted)] border border-[var(--border)] text-[var(--fg)] active:opacity-70 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
