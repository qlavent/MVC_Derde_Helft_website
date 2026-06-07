export type MatchState = 'upcoming' | 'live' | 'finished'

export interface Match {
  id: string
  rbfa_id: string
  home_team_name: string
  away_team_name: string
  home_team_rbfa_id: string | null
  away_team_rbfa_id: string | null
  start_time: string
  state: MatchState
  series_name: string | null
  is_home_game: boolean
  rbfa_home_score: number | null
  rbfa_away_score: number | null
  manual_home_score: number | null
  manual_away_score: number | null
  instagram_post_url: string | null
  synced_at: string
}

export interface Player {
  id: string
  rbfa_id: string
  first_name: string
  last_name: string
  synced_at: string
}

export interface Goal {
  id: string
  match_id: string
  player_id: string | null
  minute: number | null
  is_corner_goal: boolean
  created_at: string
  player?: Player
}

export interface Corner {
  id: string
  match_id: string
  taker_id: string | null
  header_id: string | null
  minute: number | null
  is_goal: boolean
  created_at: string
  taker?: Player
  header?: Player
}

export interface Card {
  id: string
  match_id: string
  player_id: string | null
  player_name_rbfa: string | null
  minute: number | null
  card_type: 'yellow' | 'red'
  source: string
  player?: Player
}

export interface Motm {
  id: string
  match_id: string
  player_id: string
  player?: Player
}

export interface KitCarrier {
  id: string
  match_id: string
  player_id: string
  notes: string | null
  player?: Player
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string | null
  location: string | null
  event_type: string
  include_in_ical: boolean
  created_at: string
}

export interface PlayerStats {
  player: Player
  goals: number
  corner_goals: number
  corners_taken: number
  corners_headed: number
  yellow_cards: number
  red_cards: number
  motm_count: number
  games_played: number
  wins: number
  draws: number
  losses: number
}
