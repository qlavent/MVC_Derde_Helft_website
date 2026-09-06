'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Goal, Trophy, ListChecks, User } from 'lucide-react'

const navItems = [
  { href: '/voorspellingen', label: 'Wedstrijden', icon: Goal },
  { href: '/voorspellingen/stand', label: 'Stand', icon: Trophy },
  { href: '/voorspellingen/resultaten', label: 'Resultaten', icon: ListChecks },
  { href: '/voorspellingen/mij', label: 'Mij', icon: User },
]

const INDEX = '/voorspellingen'

/**
 * The CL Poule section's own bottom dock (spec decision 2). Same build as
 * components/BottomNav.tsx — glass pill, accent-highlighted active item — but a
 * separate component so the two sections stay independent.
 *
 * `missingCount` is the in-app reminder count (spec decision 13). The caller
 * fetches it; this component only renders it.
 */
export default function UclDock({ missingCount = 0 }: { missingCount?: number }) {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex items-center justify-center px-4">
      <div className="glass flex items-center gap-1 px-3 py-2 rounded-2xl">
        {navItems.map(({ href, label, icon: Icon }) => {
          // The index is a prefix of every other route, so it only matches exactly.
          const active = href === INDEX ? pathname === INDEX : pathname.startsWith(href)
          const badge = href === INDEX && missingCount > 0
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: active ? 'var(--muted)' : 'transparent' }}
            >
              <Icon
                size={20}
                style={{ color: active ? 'var(--sand)' : 'var(--subtle)' }}
                strokeWidth={active ? 2.5 : 1.5}
              />
              {badge && (
                <span
                  aria-label={`${missingCount} wedstrijden zonder voorspelling`}
                  className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center tabular"
                  style={{
                    background: 'var(--sand)',
                    color: 'var(--sand-fg)',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {missingCount > 9 ? '9+' : missingCount}
                </span>
              )}
              <span style={{
                fontSize: 10,
                color: active ? 'var(--sand)' : 'var(--subtle)',
                fontWeight: active ? 600 : 400,
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
