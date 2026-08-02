-- Clean slate before the 2026-27 season: remove everything entered by hand while testing,
-- keep RBFA's official record.
--
-- NOT RUN YET. Read the notes, decide the two open questions at the bottom, then run the
-- block you want in the Supabase SQL editor.
--
-- Row counts at the time of writing (2026-08-02):
--
--   goals               15   test entries
--   corners              3   test entries
--   cards                3   test entries
--   motm                 1   test entry
--   kit_carriers         2   test entries
--   match_photos         0   nothing to remove
--   calendar_events      3   "Test event", "Test", one more — test entries
--   match_players      155   RBFA lineups, NOT hand-entered — see note 1
--   players             11   squad from RBFA — see note 2
--   matches             47   fixtures + official scores — KEEP
--   rankings_snapshots  16   official standings — KEEP
--
-- Note 1 — match_players: all 155 rows came from RBFA, none are manual. They are also
-- irreplaceable: RBFA returns matchDetail: null for past seasons, so once deleted, last
-- season's lineups cannot be fetched again from anywhere. Deleting them would zero the
-- "games played" figure behind every player statistic for 2025-26. Left out of the wipe
-- below on purpose; uncomment only if you truly want last season's appearances gone.
--
-- Note 2 — players: the 11 rows are the squad as RBFA published it, not test data. Goals
-- and cards reference them. Keeping them means next season's stats start from a known
-- squad; deleting them means waiting for RBFA to publish the 2026-27 squad. Left in.

begin;

-- Manual match events. Order does not matter, none reference each other.
delete from goals;
delete from corners;
delete from cards;
delete from motm;
delete from kit_carriers;
delete from match_photos;

-- Test calendar entries. Check the list first if any real event has been added since:
--   select id, title, start_time, include_in_ical from calendar_events order by start_time;
delete from calendar_events;

-- Verify before committing: every count below should be 0, and matches/rankings untouched.
select 'goals' as t, count(*) from goals
union all select 'corners', count(*) from corners
union all select 'cards', count(*) from cards
union all select 'motm', count(*) from motm
union all select 'kit_carriers', count(*) from kit_carriers
union all select 'match_photos', count(*) from match_photos
union all select 'calendar_events', count(*) from calendar_events
union all select 'match_players (kept)', count(*) from match_players
union all select 'players (kept)', count(*) from players
union all select 'matches (kept)', count(*) from matches
union all select 'rankings_snapshots (kept)', count(*) from rankings_snapshots;

-- Happy with those numbers?
commit;
-- Not happy?
-- rollback;

-- Optional, only if last season's appearances should go too. This cannot be undone and the
-- data cannot be re-fetched from RBFA:
-- delete from match_players;

-- Photos live in Supabase Storage as well as in the table. If any had been uploaded, the
-- files would need removing from the match-photos bucket by hand. Currently 0 rows, so
-- nothing to do.
