import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'MVC Den Derde Helft',
  description: 'De officiële app van MVC Den Derde Helft — minivoetbal kern Deinze',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
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
