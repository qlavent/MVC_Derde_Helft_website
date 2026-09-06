'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUclSession } from '@/lib/ucl/session'
import UclDock from '@/components/ucl/UclDock'

/** The two routes a visitor can reach without a session and without a name. */
const OPEN_ROUTES = ['/voorspellingen/login', '/voorspellingen/naam']

/**
 * Decision 4: login required to see anything, plus the required display name.
 *
 * Wrap the four screens (Wedstrijden, Stand, Resultaten, Mij) in this — the section layout
 * deliberately does not, because the login and naam pages must stay reachable.
 *
 *   export default function StandPage() {
 *     return <AuthGate><Stand /></AuthGate>
 *   }
 *
 * Redirects never fire while `loading` is still true, otherwise a logged-in player gets
 * thrown back to the login screen on every refresh.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session, player } = useUclSession()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!session) router.replace('/voorspellingen/login')
    else if (!player) router.replace('/voorspellingen/naam')
  }, [loading, session, player, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--sand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Render nothing while the redirect above is in flight.
  if (!session || !player) return null

  return <>{children}</>
}

export default AuthGate

/**
 * The dock, minus the routes where there is nothing to navigate to. Lives here rather than in
 * the layout because the layout is a server component (it exports `metadata`) and this needs
 * `usePathname`.
 */
export function UclDockSlot() {
  const pathname = usePathname()
  if (OPEN_ROUTES.includes(pathname)) return null
  return <UclDock />
}
