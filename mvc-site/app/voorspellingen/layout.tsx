import type { Metadata, Viewport } from 'next'
import './ucl.css'
import { UclDockSlot } from '@/components/ucl/AuthGate'

export const metadata: Metadata = {
  title: 'CL Poule',
  // Decision 15: the section installs as its own home-screen app. This line is required —
  // the root layout sets manifest: '/manifest.json' and nested metadata only overrides it
  // when the deeper segment sets it too, so without this the section would install as the
  // minivoetbal app.
  //
  // NOTE: the href only resolves once the section manifest is served as a route handler at
  // app/voorspellingen/manifest.webmanifest/route.ts. Next's `manifest` file convention is
  // root-only (its match is anchored `^/manifest`, unlike sitemap and icon), so a nested
  // app/voorspellingen/manifest.ts is ignored: no route, no auto-injected <link>.
  manifest: '/voorspellingen/manifest.webmanifest',
}

// Navy status bar and splash inside the section, instead of the kit's near-black.
export const viewport: Viewport = {
  themeColor: '#0A1226',
}

/**
 * Shell for the CL Poule section.
 *
 * Two things it deliberately does NOT do:
 *
 *  1. No link back to the minivoetbal app (decision 1: hidden entry, separate audience).
 *  2. No AuthGate. Wrapping the layout would gate /voorspellingen/login and
 *     /voorspellingen/naam too, and a visitor who cannot reach the login screen can never get
 *     in. Each of the four screens wraps itself instead:
 *
 *       import AuthGate from '@/components/ucl/AuthGate'
 *       export default function Page() { return <AuthGate>…</AuthGate> }
 *
 * Colours come from ucl.css, which redefines the app's tokens (--bg, --fg, --surface, --sand …)
 * inside `.ucl-app`. So plain `var(--bg)` here is the CL navy, not the kit black, and the
 * existing utility classes keep working.
 */
export default function VoorspellingenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ucl-app min-h-screen pb-32 bg-[var(--bg)] text-[var(--fg)]">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-black">CL Poule</h1>
      </header>
      {children}
      <UclDockSlot />
    </div>
  )
}
