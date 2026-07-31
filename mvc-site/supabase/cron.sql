-- Scheduled RBFA sync: Supabase pg_cron calls the site's /api/sync every 15 minutes.
-- Run this once in the Supabase SQL editor, after filling in the two placeholders below.
--
--   <SITE_URL>      e.g. https://mvc-derde-helft.vercel.app   (no trailing slash)
--   <CRON_SECRET>   any long random string; set the same value as the CRON_SECRET
--                   environment variable in Vercel (Project Settings -> Environment
--                   Variables) so the endpoint only answers the cron.
--
-- Generate one with:  openssl rand -hex 32

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('rbfa-sync') where exists (
  select 1 from cron.job where jobname = 'rbfa-sync'
);

select cron.schedule(
  'rbfa-sync',
  '*/15 * * * *',
  $$
    select net.http_get(
      url := '<SITE_URL>/api/sync',
      headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
      timeout_milliseconds := 55000
    );
  $$
);

-- Check the schedule:
--   select jobid, jobname, schedule, active from cron.job;
-- Check recent runs:
--   select runid, status, return_message, start_time from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'rbfa-sync')
--     order by start_time desc limit 10;
-- Check what the sync replied (pg_net logs responses):
--   select id, status_code, content from net._http_response order by id desc limit 5;
