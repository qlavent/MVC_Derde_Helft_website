'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UclPlayer = {
  user_id: string
  display_name: string
  created_at: string | null
}

export type UclSessionState = {
  /** True until both the session and the player row for it have been resolved. */
  loading: boolean
  session: Session | null
  user: User | null
  /** The ucl_players row, or null when this user has not chosen a name yet. */
  player: UclPlayer | null
  refreshPlayer: () => Promise<void>
}

/**
 * Session plus player row for the CL Poule section.
 *
 * `loading` starts true and is only cleared once the player row has been fetched for the
 * current session, so it never briefly reads "logged in, no name" — AuthGate would bounce a
 * returning player to the name screen on every refresh if it did.
 */
export function useUclSession(): UclSessionState {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<UclPlayer | null>(null)
  const alive = useRef(true)

  const load = useCallback(async (userId: string | null) => {
    if (!userId) {
      setPlayer(null)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('ucl_players')
      .select('user_id, display_name, created_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (!alive.current) return
    setPlayer((data as UclPlayer) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    alive.current = true
    // onAuthStateChange fires INITIAL_SESSION with the persisted session right after
    // subscribing, so it doubles as the initial read — no separate getSession() needed.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive.current) return
      setSession(next)
      // supabase-js holds its auth lock for the duration of this callback; calling another
      // supabase method from inside it can deadlock, so hop out of it first.
      setTimeout(() => {
        if (alive.current) void load(next?.user?.id ?? null)
      }, 0)
    })
    return () => {
      alive.current = false
      data.subscription.unsubscribe()
    }
  }, [load])

  const refreshPlayer = useCallback(
    () => load(session?.user?.id ?? null),
    [load, session]
  )

  return { loading, session, user: session?.user ?? null, player, refreshPlayer }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
