-- Scheduled Champions League sync: Supabase pg_cron calls the site's /api/ucl/sync.
--
-- NOT run automatically by anything. Paste this whole file into the Supabase SQL editor once.
--
-- There are no placeholders to fill in. The site URL and the CRON_SECRET are read out of the
-- RBFA sync job that pg_cron is already running, so the two jobs cannot drift apart and the
-- secret never has to be copied by hand. If that job is missing, this raises a clear error and
-- changes nothing — see the manual fallback at the bottom.
--
-- Two jobs, because the two things the sync does have very different urgencies:
--
--   ucl-sync-live   every 5 minutes, but only actually calls out when a match is about to start,
--                   is being played, or has just ended. That is when scores change and when
--                   predictions become scoreable.
--   ucl-sync-daily  twice a day, unconditionally. Fixtures, kickoff changes and postponements
--                   need to be right long before anyone is watching.
--
-- Why the live job asks the database first: matchdays move. The league phase is Tuesday and
-- Wednesday, but knockout legs and the final are not, so a hardcoded `* * * * 2,3` would miss
-- exactly the nights that matter most. ucl_matches already knows when football is on, so it
-- decides. On a quiet Sunday the job wakes up, runs one indexed exists() against ucl_matches,
-- finds nothing, and makes no HTTP request at all — the football-data.org free tier (10 calls
-- per minute) and the Vercel function budget are both spent only on nights with football.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $do$
declare
  q        text := chr(39);   -- a single quote, so the regexes below stay readable
  base     text;
  secret   text;
  cmd_live text;
  cmd_day  text;
begin
  -- Borrow both values from the RBFA job rather than asking anyone to retype a secret.
  select substring(j.command from 'url := ' || q || '([^' || q || ']+)/api/sync' || q),
         substring(j.command from 'Bearer ([^' || q || '"]+)')
    into base, secret
    from cron.job j
   where j.command like '%/api/sync%'
     and j.command like '%Bearer %'
   limit 1;

  if base is null or secret is null then
    raise exception
      'Could not read the site URL and CRON_SECRET from the RBFA cron job. Is supabase/cron.sql scheduled? Otherwise use the manual version at the bottom of this file.';
  end if;

  raise notice 'Scheduling CL sync against %/api/ucl/sync', base;

  -- Replace any previous version of these jobs, so running this file twice is harmless.
  perform cron.unschedule(jobid) from cron.job where jobname in ('ucl-sync-live', 'ucl-sync-daily');

  -- ── Live job: every 5 minutes, guarded ─────────────────────────────────────
  -- The where clause is on the select, not inside the function call: when it is false the
  -- select returns zero rows and net.http_get is never evaluated, so no request is queued.
  cmd_live := format($f$
    select net.http_get(
      url := %L,
      headers := jsonb_build_object('Authorization', %L),
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from public.ucl_matches
      where
        -- being played right now (PAUSED is half-time)
        status in ('IN_PLAY', 'PAUSED')
        -- or kicking off within the quarter hour: picks up late kickoff changes and the
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
  $f$, base || '/api/ucl/sync', 'Bearer ' || secret);

  perform cron.schedule('ucl-sync-live', '*/5 * * * *', cmd_live);

  -- ── Slow job: twice a day, unconditional ───────────────────────────────────
  -- 06:00 and 18:00 UTC (pg_cron schedules in UTC on Supabase unless cron.timezone says
  -- otherwise). Nothing time-critical hangs on the exact hours; this is the safety net that
  -- keeps fixtures, crests and postponements fresh, and that scores anything the live job
  -- missed while the site was down.
  cmd_day := format($f$
    select net.http_get(
      url := %L,
      headers := jsonb_build_object('Authorization', %L),
      timeout_milliseconds := 55000
    );
  $f$, base || '/api/ucl/sync', 'Bearer ' || secret);

  perform cron.schedule('ucl-sync-daily', '0 6,18 * * *', cmd_day);
end
$do$;

-- Confirm both jobs exist:
select jobname, schedule, active from cron.job where jobname like 'ucl-%' order by jobname;

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
--
-- Manual fallback, if the RBFA job is not there to borrow from: replace the do-block above with
-- two plain cron.schedule() calls, substituting <SITE_URL> (no trailing slash) and <CRON_SECRET>
-- (the value set in Vercel) into the same two commands.
