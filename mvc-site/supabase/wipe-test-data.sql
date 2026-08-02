-- Clean slate before the 2026-27 season: remove everything entered by hand while testing,
-- keep what came from RBFA.
--
-- NOT RUN AUTOMATICALLY. Paste into the Supabase SQL editor when you want it. It runs in a
-- transaction and prints a count before the commit, so you can rollback if the numbers look
-- wrong.
--
-- Goes:
--   goals, corners, cards, motm, kit_carriers, match_photos   manual match events
--   calendar_events                                           test events only — check first
--
-- Stays:
--   matches              fixtures and official RBFA results
--   rankings_snapshots   official standings
--   players              the squad as RBFA published it
--   match_players        RBFA lineups — this is what "games played" counts, and it cannot be
--                        re-fetched: RBFA returns matchDetail: null for past seasons. After
--                        this wipe, 2025-26 players keep their appearances and nothing else,
--                        which is exactly the intent.
--
-- Photos also live in Supabase Storage, not just in the table. If any exist when you run
-- this, delete the objects in the match-photos bucket too — deleting the rows alone leaves
-- the files orphaned. To list what is there first:
--   in the dashboard: Storage -> match-photos

begin;

delete from goals;
delete from corners;
delete from cards;
delete from motm;
delete from kit_carriers;
delete from match_photos;

-- Test calendar entries. Look before deleting, in case a real event has been added since:
--   select id, title, start_time, include_in_ical from calendar_events order by start_time;
delete from calendar_events;

-- Everything above should read 0; everything below should be unchanged.
select 'goals' as tabel, count(*) from goals
union all select 'corners', count(*) from corners
union all select 'cards', count(*) from cards
union all select 'motm', count(*) from motm
union all select 'kit_carriers', count(*) from kit_carriers
union all select 'match_photos', count(*) from match_photos
union all select 'calendar_events', count(*) from calendar_events
union all select '— keep: matches', count(*) from matches
union all select '— keep: rankings_snapshots', count(*) from rankings_snapshots
union all select '— keep: players', count(*) from players
union all select '— keep: match_players', count(*) from match_players;

-- Numbers good?
commit;
-- Numbers wrong?
-- rollback;
