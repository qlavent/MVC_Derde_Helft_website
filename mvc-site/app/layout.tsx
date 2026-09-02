import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from '@/components/ThemeProvider'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MVC Den Derde Helft',
  description: 'De officiële app van MVC Den Derde Helft — minivoetbal kern Deinze',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

// Colours the phone's status bar and the splash screen when the app is opened from a
// home-screen shortcut. Matches the dark theme's page colour, taken from the away kit.
export const viewport: Viewport = {
  themeColor: '#0E0F11',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={spaceGrotesk.variable}>
      <body className="bg-[var(--bg)] text-[var(--fg)] min-h-screen">
        <ThemeProvider>
          <main className="pb-safe max-w-lg mx-auto">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  )
}
