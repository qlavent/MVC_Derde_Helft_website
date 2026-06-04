-- Players (synced from RBFA)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  rbfa_id text unique not null,
  first_name text not null,
  last_name text not null,
  synced_at timestamptz default now()
);

-- Matches (synced from RBFA)
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  rbfa_id text unique not null,
  home_team_name text not null,
  away_team_name text not null,
  home_team_rbfa_id text,
  away_team_rbfa_id text,
  start_time timestamptz not null,
  state text not null default 'upcoming',
  series_name text,
  is_home_game boolean not null default false,
  rbfa_home_score int,
  rbfa_away_score int,
  manual_home_score int,
  manual_away_score int,
  instagram_post_url text,
  synced_at timestamptz default now()
);

-- Player selection per match
create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  source text default 'manual',
  unique(match_id, player_id)
);

-- Goals (manual)
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id),
  minute int,
  is_corner_goal boolean default false,
  created_at timestamptz default now()
);

-- Corners (manual, 2-person)
create table if not exists corners (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  taker_id uuid references players(id),
  header_id uuid references players(id),
  minute int,
  is_goal boolean default false,
  created_at timestamptz default now()
);

-- Cards (synced from RBFA or manual)
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id),
  player_name_rbfa text,
  minute int,
  card_type text not null,
  source text default 'manual',
  rbfa_event_key text
);

-- Man of the match
create table if not exists motm (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade unique,
  player_id uuid references players(id),
  created_at timestamptz default now()
);

-- Kit carrier per match
create table if not exists kit_carriers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade unique,
  player_id uuid references players(id),
  notes text,
  created_at timestamptz default now()
);

-- Team calendar events
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  location text,
  event_type text default 'event',
  include_in_ical boolean default true,
  created_at timestamptz default now()
);

-- Disable RLS on all tables (public app)
alter table players disable row level security;
alter table matches disable row level security;
alter table match_players disable row level security;
alter table goals disable row level security;
alter table corners disable row level security;
alter table cards disable row level security;
alter table motm disable row level security;
alter table kit_carriers disable row level security;
alter table calendar_events disable row level security;
