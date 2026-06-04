'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Users, CalendarDays, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/wedstrijden', label: 'Wedstrijden', icon: Calendar },
  { href: '/spelers', label: 'Spelers', icon: Users },
  { href: '/kalender', label: 'Kalender', icon: CalendarDays },
]

const moreItems = [
  { href: '/instagram', label: 'Instagram' },
  { href: '/wiel', label: 'Wiel' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute bottom-20 right-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-5 py-4 text-[var(--fg)] hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)]"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => { toggle(); setMoreOpen(false) }}
              className="flex items-center gap-3 px-5 py-4 w-full text-left text-[var(--fg)] hover:bg-[var(--muted)] transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Licht thema' : 'Donker thema'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 min-w-[3rem] py-1"
              >
                <Icon
                  size={22}
                  className={active ? 'text-[var(--sand)]' : 'text-[var(--subtle)]'}
                  strokeWidth={active ? 2.5 : 1.5}
                />
                <span className={`text-[10px] ${active ? 'text-[var(--sand)] font-semibold' : 'text-[var(--subtle)]'}`}>
                  {label}
                </span>
              </Link>
            )
          })}

          {/* Theme toggle — always visible */}
          <button
            onClick={toggle}
            className="flex flex-col items-center gap-1 min-w-[3rem] py-1"
          >
            {theme === 'dark'
              ? <Sun size={22} className="text-[var(--subtle)]" strokeWidth={1.5} />
              : <Moon size={22} className="text-[var(--subtle)]" strokeWidth={1.5} />
            }
            <span className="text-[10px] text-[var(--subtle)]">Thema</span>
          </button>

          {/* Meer button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center gap-1 min-w-[3rem] py-1"
          >
            <MoreHorizontal
              size={22}
              className={moreOpen ? 'text-[var(--sand)]' : 'text-[var(--subtle)]'}
              strokeWidth={moreOpen ? 2.5 : 1.5}
            />
            <span className={`text-[10px] ${moreOpen ? 'text-[var(--sand)] font-semibold' : 'text-[var(--subtle)]'}`}>
              Meer
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
