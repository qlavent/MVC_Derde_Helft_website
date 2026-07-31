-- Sync fixes. Safe to re-run.

-- Tables that were created by hand in the dashboard and never made it into schema.sql.
create table if not exists rankings_snapshots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  serie_id text not null,
  serie_name text,
  position int,
  team_name text not null,
  team_logo text,
  points int,
  synced_at timestamptz default now(),
  unique (season, serie_id, team_name)
);

create table if not exists match_photos (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  url text not null,
  created_at timestamptz default now()
);

alter table rankings_snapshots disable row level security;
alter table match_photos disable row level security;

-- The card sync upserts with on_conflict=rbfa_event_key, but no unique index existed, so
-- every RBFA card insert failed with 42P10 and was swallowed. NULLs stay distinct in a
-- unique index, so manually entered cards (rbfa_event_key is null) are unaffected.
create unique index if not exists cards_rbfa_event_key_key on cards (rbfa_event_key);
