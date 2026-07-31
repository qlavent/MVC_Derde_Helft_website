-- Convert matches.start_time from "Brussels wall clock stored as if it were UTC" to a real
-- UTC instant.
--
-- The old sync wrote RBFA's zone-less "2026-09-09T21:00:00" straight into a timestamptz
-- column, so Postgres read 21:00 as UTC when it actually meant 21:00 in Brussels. Display
-- code compensated with the viewer's own UTC offset, which was only correct for viewers
-- sitting in Belgium. From now on the column holds true instants and display converts to
-- Europe/Brussels explicitly.
--
-- Reading the conversion: `AT TIME ZONE 'UTC'` drops the (wrong) zone to get the wall-clock
-- value back, then `AT TIME ZONE 'Europe/Brussels'` reinterprets that wall clock in the
-- right zone. Per-row and DST-aware: summer matches shift 2h, winter matches 1h.
--
-- RUN ONCE. Applying the shift twice would move every match another hour or two, so the
-- backup table doubles as the guard: if it already exists, this does nothing.
-- Rollback:  update matches m set start_time = b.start_time
--              from matches_tz_backup b where b.id = m.id;

do $$
declare
  moved int;
begin
  if to_regclass('public.matches_tz_backup') is not null then
    raise notice 'matches_tz_backup exists — already migrated, skipping';
    return;
  end if;

  create table matches_tz_backup as
    select id, rbfa_id, start_time from matches;

  update matches
     set start_time = (start_time at time zone 'UTC') at time zone 'Europe/Brussels';

  select count(*) into moved from matches;
  raise notice 'converted % matches to UTC (backup in matches_tz_backup)', moved;
end $$;

-- calendar_events is deliberately untouched: those rows were written with
-- new Date(...).toISOString() and are already true UTC instants.

-- Sanity check — a 21:00 Brussels kickoff should now read 19:00Z in summer, 20:00Z in winter:
--   select start_time,
--          start_time at time zone 'Europe/Brussels' as brussels_wall_clock
--     from matches order by start_time limit 5;
