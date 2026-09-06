'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUclSession } from '@/lib/ucl/session'

/**
 * The display name (decision 11: required, unique case-insensitively, changeable later).
 *
 * Doubles as the rename screen linked from Mij, so it prefills whatever the player has now.
 * NOT wrapped in AuthGate — the gate sends nameless players here — but it does need a
 * session, since the insert is scoped to auth.uid() by RLS.
 *
 * The user's email address appears nowhere on this page: only names are ever shown.
 */
export default function NaamPage() {
  const router = useRouter()
  const { loading, session, player, refreshPlayer } = useUclSession()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !session) router.replace('/voorspellingen/login')
  }, [loading, session, router])

  useEffect(() => {
    if (player) setName(player.display_name)
  }, [player])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 24) {
      setError('Kies een naam van 2 tot 24 tekens.')
      return
    }
    if (!session) return
    setSaving(true)
    setError(null)
    // One upsert covers both cases: the first name and every later rename.
    const { error } = await supabase
      .from('ucl_players')
      .upsert({ user_id: session.user.id, display_name: trimmed }, { onConflict: 'user_id' })
    setSaving(false)
    if (error) {
      // 23505 is the unique index on lower(trim(display_name)) — the only way two players can
      // collide here, since the user_id conflict is what the upsert resolves.
      setError(
        error.code === '23505'
          ? 'Die naam is al genomen. Kies een andere.'
          : `Opslaan lukte niet: ${error.message}`
      )
      return
    }
    await refreshPlayer()
    router.replace('/voorspellingen')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--sand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return null

  return (
    <div className="px-4">
      <form
        onSubmit={save}
        className="ucl-card p-5"
      >
        <h2 className="text-base font-bold mb-1">
          {player ? 'Naam wijzigen' : 'Kies je naam'}
        </h2>
        <p className="text-sm text-[var(--subtle)] leading-relaxed mb-4">
          Dit is de naam die de rest van de poule ziet in de stand. Je kan hem later altijd nog
          veranderen.
        </p>
        {/* 16px minimum: iOS zooms into a smaller focused field and never zooms back. */}
        <input
          type="text"
          autoComplete="nickname"
          maxLength={24}
          required
          placeholder="Bijv. Jan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-base rounded-xl px-4 py-3 bg-[var(--muted)] text-[var(--fg)] placeholder-[var(--subtle)] border border-[var(--border)] focus:outline-none"
        />
        {error && <p className="text-sm text-red-400 leading-relaxed mt-3">{error}</p>}
        <button
          type="submit"
          disabled={saving || name.trim().length < 2}
          className="w-full mt-4 rounded-xl py-3 font-bold bg-[var(--sand)] text-[var(--sand-fg)] disabled:opacity-40"
        >
          {saving ? 'Opslaan…' : 'Bewaren'}
        </button>
      </form>
    </div>
  )
}
