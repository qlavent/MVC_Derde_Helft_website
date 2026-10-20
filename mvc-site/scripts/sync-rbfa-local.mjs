// Runs the RBFA sync from THIS machine instead of from Vercel.
//
// Why this exists: RBFA put their datalake behind Akamai, which blocks Vercel's datacenter IPs
// (US serverless and EU Edge were both verified to get "Access Denied"). A normal residential
// connection is allowed, so the sync has to originate from one — e.g. your PC or a home server.
//
//   cd mvc-site
//   node scripts/sync-rbfa-local.mjs
//
// It reads mvc-site/.env.local for:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     (the same value that is set in Vercel; keep it secret)
//
// It does exactly what GET/POST /api/sync does on the server — one syncRbfa() pass — so the app
// keeps reading the same ucl_... and matches tables as before. Schedule it (see README note at
// the bottom) to run every 15 minutes, or just run it by hand after matches.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { syncRbfa } from '../lib/rbfa.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// Minimal .env.local loader — no dependency on dotenv.
function loadEnv() {
  try {
    const text = readFileSync(join(here, '..', '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* fall back to the real environment */
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Put them in mvc-site/.env.local.'
  )
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const started = new Date()
console.log(`[${started.toISOString()}] RBFA sync (local) started`)
try {
  const results = await syncRbfa(db)
  for (const line of results) console.log('  ' + line)
  console.log(`[${new Date().toISOString()}] done in ${Date.now() - started.getTime()}ms`)
} catch (err) {
  console.error(`[${new Date().toISOString()}] FAILED: ${err?.message ?? err}`)
  process.exit(1)
}
