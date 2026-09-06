-- Scheduled Champions League sync: Supabase pg_cron calls the site's /api/ucl/sync.
--
-- NOT run automatically by anything. Like supabase/cron.sql, this is a one-off script the owner
-- pastes into the Supabase SQL editor after filling in the two placeholders below. Migrations in
-- supabase/migrations/ do not include it, and no deploy touches it.
--
--   <SITE_URL>      e.g. https://mvc-derde-helft.vercel.app   (no trailing slash)
--   <CRON_SECRET>   the same value as the CRON_SECRET environment variable in Vercel.
--                   The RBFA sync already uses one — reuse it, the endpoint checks the same var.
--
-- Two jobs, because the two things the sync does have very different urgencies (decision 6):
--
--   ucl-sync-live   every 5 minutes, but only actually calls out when a match is about to start,
--                   is being played, or has just ended. That is when scores change and when
--                   predictions become scoreable.
--   ucl-sync-daily  twice a day, unconditionally. Fixtures, kickoff changes and postponements
--                   need to be right long before anyone is watching.
--
-- Why the live job asks the database first: matchdays move. The group stage is Tuesday and
-- Wednesday, but knockout legs, replays and the final are not, so a hardcoded `* * * * 2,3`
-- would miss exactly the nights that matter most. ucl_matches already knows when football is on,
-- so it decides. On a quiet Sunday the job wakes up, runs one indexed exists() against
-- ucl_matches, finds nothing, and makes no HTTP request at all — the football-data.org free tier
-- (10 calls/minute) and the Vercel function budget are both spent only on nights with football.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Live job: every 5 minutes, guarded ───────────────────────────────────────
select cron.unschedule('ucl-sync-live') where exists (
  select 1 from cron.job where jobname = 'ucl-sync-live'
);

select cron.schedule(
  'ucl-sync-live',
  '*/5 * * * *',
  $$
    -- The where clause is on the select, not inside the function call: when it is false the
    -- select returns zero rows and net.http_get is never evaluated, so no request is queued.
    select net.http_get(
      url := '<SITE_URL>/api/ucl/sync',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from public.ucl_matches
      where
        -- being played right now (PAUSED is half-time)
        status in ('IN_PLAY', 'PAUSED')
        -- or kicking off within the quarter hour: pick up late kickoff changes and the
        -- SCHEDULED/TIMED -> IN_PLAY transition promptly
        or (status in ('SCHEDULED', 'TIMED')
            and utc_kickoff between now() and now() + interval '15 minutes')
        -- or just finished, so the scoring pass gets a few more chances at it. There is no
        -- finished_at column, so kickoff is the proxy: 90 minutes plus stoppage, half-time and
        -- (in the knockouts) extra time and penalties puts the final whistle at roughly
        -- kickoff + 2h30. Five hours after kickoff therefore still covers a match that ended
        -- within the last ~3 hours, which is what a late final needs.
        or (status = 'FINISHED' and utc_kickoff > now() - interval '5 hours')
    );
  $$
);

-- ── Slow job: twice a day, unconditional ─────────────────────────────────────
-- 06:00 and 18:00 UTC (pg_cron schedules in UTC on Supabase unless cron.timezone says
-- otherwise). Nothing time-critical hangs on the exact hours; this is the safety net that keeps
-- fixtures, crests and postponements fresh, and that scores anything the live job missed while
-- the site was down.
select cron.unschedule('ucl-sync-daily') where exists (
  select 1 from cron.job where jobname = 'ucl-sync-daily'
);

select cron.schedule(
  'ucl-sync-daily',
  '0 6,18 * * *',
  $$
    select net.http_get(
      url := '<SITE_URL>/api/ucl/sync',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
      timeout_milliseconds := 55000
    );
  $$
);

-- Check the schedule:
--   select jobid, jobname, schedule, active from cron.job where jobname like 'ucl-%';
-- Check recent runs (a skipped live run still shows as succeeded — it ran, it just did nothing):
--   select j.jobname, d.runid, d.status, d.return_message, d.start_time
--     from cron.job_run_details d join cron.job j using (jobid)
--     where j.jobname like 'ucl-%' order by d.start_time desc limit 20;
-- Check what the sync replied (pg_net logs responses; only guarded runs that fired appear here):
--   select id, status_code, content from net._http_response order by id desc limit 5;
-- Check whether the guard would fire right now, and why:
--   select id, home_team, away_team, status, utc_kickoff from ucl_matches
--     where status in ('IN_PLAY', 'PAUSED')
--        or (status in ('SCHEDULED', 'TIMED')
--            and utc_kickoff between now() and now() + interval '15 minutes')
--        or (status = 'FINISHED' and utc_kickoff > now() - interval '5 hours')
--     order by utc_kickoff;
