'use client'
import { useTheme } from './ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full transition-colors"
      style={{ background: 'var(--muted)', color: 'var(--fg)' }}
      aria-label="Wissel thema"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
