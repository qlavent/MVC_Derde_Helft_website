import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { syncRbfa } from '@/lib/rbfa.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// NOTE: RBFA's datalake is behind Akamai, which blocks Vercel's datacenter IPs — US serverless
// AND EU Edge were both verified to get "Access Denied". So this endpoint cannot reach RBFA from
// Vercel on any plan/region. The sync now runs from an allowed (residential) IP instead; see
// scripts/sync-rbfa-local.mjs. This route is kept only so it resumes working if RBFA ever lifts
// the datacenter block.

async function run() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }
  try {
    const results = await syncRbfa(supabaseServer())
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Sync RBFA button in the app.
export async function POST() {
  return run()
}

// Scheduled sync (Supabase pg_cron — see supabase/cron.sql). Requires CRON_SECRET so the
// scheduled entrypoint isn't an open trigger for anyone crawling the site.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}
