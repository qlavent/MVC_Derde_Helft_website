'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Users, CalendarDays, Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/wedstrijden', label: 'Wedstrijden', icon: Calendar },
  { href: '/spelers', label: 'Spelers', icon: Users },
  
  { href: '/kalender', label: 'Kalender', icon: CalendarDays },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex items-center justify-center px-4">
      <div className="glass flex items-center gap-1 px-3 py-2 rounded-2xl">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: active ? 'var(--muted)' : 'transparent' }}
            >
              <Icon
                size={20}
                style={{ color: active ? 'var(--sand)' : 'var(--subtle)' }}
                strokeWidth={active ? 2.5 : 1.5}
              />
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

        {/* Divider */}
        <div className="w-px h-8 mx-1" style={{ background: 'var(--border)' }} />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: 'transparent' }}
        >
          {theme === 'dark'
            ? <Sun size={20} style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
            : <Moon size={20} style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
          }
          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
            {theme === 'dark' ? 'Licht' : 'Donker'}
          </span>
        </button>
      </div>
    </div>
  )
}
