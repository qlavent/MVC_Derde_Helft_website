import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { syncRbfa } from '@/lib/rbfa.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
