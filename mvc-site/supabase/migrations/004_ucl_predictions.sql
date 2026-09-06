-- Champions League prediction game.
--
-- Separate from the minivoetbal tables in every sense: its own tables, its own rules, and
-- unlike the rest of this database these tables have RLS ENABLED. That is not optional here.
-- The anon key ships inside the browser, so without policies anyone could read and overwrite
-- anyone's predictions straight through the REST API. The three rules below are therefore
-- enforced by Postgres, not by the UI:
--
--   1. you may only write your own prediction        (user_id = auth.uid())
--   2. you may not write one once the match started  (kickoff > now(), checked per row)
--   3. predictions are readable by every logged-in player (the group chose transparency)
--
-- Rule 3 has two independent halves. Nothing at all is readable without a session (decision 4:
-- every select policy is `to authenticated`), and within that, players see each other's
-- predictions. The second half is one line to reverse if the group later decides copying
-- spoils the game; see the select policy on ucl_predictions.

-- ── Matches, cached from football-data.org ────────────────────────────────────
-- Written only by the sync running with the service role. No write policy exists for
-- anonymous or logged-in users, so they cannot touch it.
create table if not exists ucl_matches (
  id            bigint primary key,             -- football-data.org match id
  competition   text        not null default 'CL',
  season        text,                           -- e.g. '2026-2027'
  stage         text,
  matchday      int,
  utc_kickoff   timestamptz not null,
  home_team     text        not null,
  away_team     text        not null,
  home_crest    text,
  away_crest    text,
  status        text        not null,           -- SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED
  home_score    int,
  away_score    int,
  synced_at     timestamptz default now()
);

create index if not exists ucl_matches_kickoff_idx on ucl_matches (utc_kickoff);
create index if not exists ucl_matches_matchday_idx on ucl_matches (season, stage, matchday);

-- ── Players ──────────────────────────────────────────────────────────────────
-- One row per logged-in user, holding the name shown on the leaderboard.
create table if not exists ucl_players (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 24),
  created_at   timestamptz default now()
);

-- Decision 11: names are unique case-insensitively, and still changeable from Mij.
-- This is an index and not a check constraint or a trigger on purpose. A check constraint can
-- only see the row being written, so it cannot know a name is taken. A trigger doing
-- `if exists (select 1 from ucl_players where lower(...) = ...)` reads a snapshot: two people
-- claiming "Jan" in the same second both see no conflict, both pass, and the table ends up with
-- a duplicate. The index is the only mechanism that serialises the two writers — the loser gets
-- a clean 23505 unique_violation, which the client turns into "naam al in gebruik".
create unique index if not exists ucl_players_display_name_uniq
  on ucl_players (lower(trim(display_name)));

-- ── Predictions ──────────────────────────────────────────────────────────────
create table if not exists ucl_predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid   not null references auth.users (id) on delete cascade,
  match_id    bigint not null references ucl_matches (id) on delete cascade,
  home_goals  int    not null check (home_goals between 0 and 20),
  away_goals  int    not null check (away_goals between 0 and 20),
  -- null until the match is finished and the sync scores it. Deliberately not defaulted to
  -- a value: the Discord bot stored 1 point on every unscored prediction, which made
  -- "not yet scored" and "scored 1" indistinguishable.
  points      int,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, match_id)
);

create index if not exists ucl_predictions_match_idx on ucl_predictions (match_id);
create index if not exists ucl_predictions_user_idx on ucl_predictions (user_id);

-- ── Row level security ───────────────────────────────────────────────────────
alter table ucl_matches     enable row level security;
alter table ucl_players     enable row level security;
alter table ucl_predictions enable row level security;

-- Decision 4: login required to see anything. Every select policy below is `to authenticated`,
-- so the anon key on its own reads nothing at all — an unauthenticated visitor gets empty
-- results from the REST API and the app can only show the login screen. `using (true)` inside
-- these policies means "any logged-in player", not "anyone".
--
-- Fixtures: every player reads, nobody writes (the sync uses the service role, which bypasses RLS).
drop policy if exists "matches readable by all" on ucl_matches;
create policy "matches readable by all" on ucl_matches for select to authenticated using (true);

-- Players: names are visible to the group so the leaderboard can show them; you manage only
-- your own row.
drop policy if exists "players readable by all" on ucl_players;
create policy "players readable by all" on ucl_players for select to authenticated using (true);

drop policy if exists "insert own player row" on ucl_players;
create policy "insert own player row" on ucl_players for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own player row" on ucl_players;
create policy "update own player row" on ucl_players for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Predictions, rule 3: every logged-in player can read every other player's (decision 12 —
-- the UI still hides them behind a per-match dropdown, but that is presentation, not a rule).
-- To hide them until kickoff instead, keep `to authenticated` and replace `using (true)` with:
--   using (user_id = auth.uid() or exists (
--     select 1 from ucl_matches m where m.id = match_id and m.utc_kickoff <= now()))
-- Your own predictions stay visible either way, otherwise you could not edit them.
drop policy if exists "predictions readable by all" on ucl_predictions;
create policy "predictions readable by all" on ucl_predictions for select to authenticated using (true);

-- Rules 1 and 2, on insert: your own row, and only while the match has not started.
drop policy if exists "insert own prediction before kickoff" on ucl_predictions;
create policy "insert own prediction before kickoff" on ucl_predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from ucl_matches m
      where m.id = ucl_predictions.match_id
        and m.utc_kickoff > now()
        and m.status in ('SCHEDULED', 'TIMED')
    )
  );

-- Same on update. USING controls which rows you may target, WITH CHECK what you may leave
-- behind, so both need the kickoff test — otherwise a row could be edited into a locked match.
drop policy if exists "update own prediction before kickoff" on ucl_predictions;
create policy "update own prediction before kickoff" on ucl_predictions for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from ucl_matches m
      where m.id = ucl_predictions.match_id
        and m.utc_kickoff > now()
        and m.status in ('SCHEDULED', 'TIMED')
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from ucl_matches m
      where m.id = ucl_predictions.match_id
        and m.utc_kickoff > now()
        and m.status in ('SCHEDULED', 'TIMED')
    )
  );

-- No delete policy: a submitted prediction cannot be withdrawn, only changed before kickoff.

-- points is written by the sync (service role) only. No user-facing update policy can set it,
-- because the update policy above still allows changing the row's own columns — so guard it
-- with a trigger that rejects any user attempt to change points.
create or replace function ucl_guard_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() reads `sub` from the request's JWT. A logged-in player always has one; the sync
  -- authenticates with the service role key, whose JWT carries a role but no `sub`, so
  -- auth.uid() is null there and the sync (and the SQL editor) may award points.
  --
  -- INSERT and UPDATE both need guarding. On insert `old` is null, so the case expression
  -- yields null and any non-null points is a player awarding themselves 10 on a brand new row —
  -- which the insert policy alone happily allows, since it only constrains user_id and kickoff.
  -- Consequence for the client: never send `points` in an insert or upsert. Omit the column;
  -- echoing a value the server gave you back is what turns this guard into a mystery 500.
  if auth.uid() is not null
     and new.points is distinct from (case when tg_op = 'UPDATE' then old.points end) then
    raise exception 'points are awarded by the system and cannot be set by a player';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ucl_predictions_guard on ucl_predictions;
create trigger ucl_predictions_guard before insert or update on ucl_predictions
  for each row execute function ucl_guard_points();

-- ── Leaderboard ──────────────────────────────────────────────────────────────
-- A view rather than a running total column. The Discord bot incremented users.points with a
-- read-then-write, which can lose points if two matches are scored at once and makes a partial
-- failure impossible to detect. Summing the source of truth cannot drift.
-- Decision 7 (season and all-time tabs) is served by this one view rather than two. It is
-- grouped per (season, user), so the season tab filters on `season` and the all-time tab sums
-- the same rows across seasons client-side — one query feeds both tabs, and nothing can drift
-- between them.
--
-- Standings show points only (decision 8). `predictions`, `scored` and `exact_hits` are kept
-- anyway: they are the same single pass over the rows, so they cost nothing, and when a total
-- looks wrong they immediately say whether the cause is unscored rows or a scoring bug.
--
-- Dropped rather than replaced: `create or replace view` cannot add a column at the front, so
-- re-running this file over the old (season-less) view would fail on the column rename.
drop view if exists ucl_leaderboard;
create view ucl_leaderboard
with (security_invoker = true) as
select
  m.season                                             as season,
  p.user_id                                            as user_id,
  coalesce(pl.display_name, 'Onbekend')                as display_name,
  count(p.id)                                          as predictions,
  count(p.points)                                      as scored,
  coalesce(sum(p.points), 0)::int                      as points,
  count(*) filter (where p.points = 10)                as exact_hits
from ucl_predictions p
join ucl_matches m on m.id = p.match_id
left join ucl_players pl on pl.user_id = p.user_id
group by m.season, p.user_id, pl.display_name;

-- Sanity checks after running this:
--   select tablename, rowsecurity from pg_tables where tablename like 'ucl%';
--   select tablename, policyname, cmd, roles from pg_policies where tablename like 'ucl%' order by 1,3;
--   select indexname, indexdef from pg_indexes where tablename = 'ucl_players';
--   select season, display_name, points from ucl_leaderboard order by season desc, points desc;
