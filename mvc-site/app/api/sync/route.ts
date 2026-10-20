import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { syncRbfa } from '@/lib/rbfa.mjs'

export const dynamic = 'force-dynamic'
// RBFA's datalake sits behind Akamai, which blocks requests from Vercel's US serverless IP
// (iad1) — region pinning needs Vercel Pro, so on Hobby the serverless function is stuck there.
// The Edge runtime egresses from a different network and runs near the caller (EU), which the
// Belgian FA's edge is far more likely to allow. If this still gets "Access Denied", the sync
// has to run from an allowed IP instead (see the scripts/ fallback).
export const runtime = 'edge'
export const preferredRegion = 'fra1'

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
