// Spec decision 15: the section installs as its own home-screen app, separate from the
// minivoetbal one. Same shape as public/manifest.json but scoped to /voorspellingen and in
// the CL navy.
//
// A route handler rather than Next's `manifest.ts` file convention, because that convention
// is root-only: Next matches metadata manifests with an anchored `^[\/]manifest`, unlike
// sitemap and icon which match at any depth. A nested app/voorspellingen/manifest.ts is
// therefore ignored entirely — no route generated, nothing served, no link injected. Verified
// by its absence from the build's route list. The layout's `metadata.manifest` points here.

const manifest = {
  name: 'CL Poule',
  short_name: 'CL Poule',
  description: 'Voorspel de uitslagen van de Champions League en volg de stand',
  lang: 'nl',
  start_url: '/voorspellingen',
  scope: '/voorspellingen',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0A1226',
  theme_color: '#0A1226',
  // Written as the combined "any maskable" string, matching public/manifest.json. Both icons
  // are full-bleed navy, so Android's maskable crop cannot expose a transparent corner.
  icons: [
    { src: '/icon-cl-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon-cl-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}

export function GET() {
  return Response.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
