# CL Poule — spec and decision record

Champions League prediction game, living inside the minivoetbal app's codebase but presented
as a separate app. Ported from the Discord bot at qlavent/discord_ucl_prediction_game.

Branch: `feat/ucl-predictions`. Nothing here is linked from the minivoetbal side.

## Decisions (settled with the owner, do not relitigate)

| # | Decision | Consequence |
|---|---|---|
| 1 | Route `/voorspellingen`, **hidden entry** — no link from the minivoetbal app | Different friend group; team gets `/`, poule players get the deep link |
| 2 | Four screens: Wedstrijden, Stand, Resultaten, Mij | Own bottom dock with four items |
| 3 | Inline steppers (− n +) per team, **autosave** with a brief `opgeslagen` tick | No modal, no keyboard, thumb-friendly for ~18 matches |
| 4 | **Login required to see anything** | Read policies are `to authenticated`; unauthenticated sees only the login screen |
| 5 | **All future matches** predictable, grouped by matchday, collapsible, nearest expanded | `currentMatchday()` only decides which section starts open |
| 6 | Sync frequently **only when matches are near or in play**, decided from our own data | pg_cron checks `ucl_matches` before calling the endpoint; no hardcoded weekdays, so knockout nights work |
| 7 | Leaderboard has **season and all-time** tabs | Two aggregations |
| 8 | Missed prediction earns nothing; leaderboard shows **points only** | Owner accepted that this rewards participation; no averages displayed |
| 9 | **Fully distinct design** from the minivoetbal app | Own palette, own card styling, light and dark |
| 10 | Palette: bg `#0A1226`, text `#E8ECF8`, accent `#3B82F6`, card `#16204A` | Light variant in pale blue-grey |
| 11 | Display name **unique** (case-insensitive), changeable from Mij | Unique index on `lower(display_name)` |
| 12 | Others' predictions **visible, but behind a per-match dropdown** | Owner accepted the copying risk in exchange for transparency |
| 13 | Reminders: **in-app count only** (`5 wedstrijden zonder voorspelling`) | No push, no email |
| 14 | Testing on branch preview deployments | Same Supabase project — test predictions must be cleaned before launch |
| 15 | **Own manifest** at the section, own name and navy icon, `start_url` into the section | A separate home-screen app from the minivoetbal one |
| 16 | Name: **CL Poule** | Header and icon label |

Scoring is the bot's table unchanged: exact **10**, goal difference **7**, winner **5**,
otherwise **1**. Already implemented in `lib/ucl/score.mjs`.

## Already built (do not rewrite)

- `supabase/migrations/004_ucl_predictions.sql` — tables, RLS, policies, points guard trigger, leaderboard view
- `lib/ucl/score.mjs` — `pointsFor`, `isOpen`
- `lib/ucl/api.mjs` — `fetchMatches`, `toRow`, `currentMatchday`
- `app/api/ucl/sync/route.ts` — fetch + upsert + idempotent scoring, behind `CRON_SECRET`
- `scripts/check-ucl.mjs` — runnable checks for scoring, the kickoff lock and matchday selection

## Data shapes

```
ucl_matches      id (bigint, football-data id), competition, season, stage, matchday,
                 utc_kickoff, home_team, away_team, home_crest, away_crest,
                 status (SCHEDULED|TIMED|IN_PLAY|PAUSED|FINISHED), home_score, away_score
ucl_players      user_id (uuid, = auth.uid()), display_name, created_at
ucl_predictions  id, user_id, match_id, home_goals, away_goals, points (null until scored)
                 unique (user_id, match_id)
ucl_leaderboard  view: user_id, display_name, predictions, scored, points, exact_hits
```

## Non-negotiable rules, enforced in Postgres not the UI

1. `user_id = auth.uid()` on insert and update — you cannot write someone else's prediction
2. Kickoff lock: insert and update require `utc_kickoff > now()` and status in
   (`SCHEDULED`,`TIMED`), in both `USING` and `WITH CHECK`
3. `points` is rejected from players by a trigger; only the sync (service role) awards it
4. No delete policy — a prediction can be changed before kickoff, never withdrawn

The UI must *also* prevent late edits (disable the steppers), but the database is the
authority. Never rely on hiding a control.

## Conventions to follow (match the existing codebase)

- Dutch UI strings throughout, Brussels time for display (`formatBrussels` / `toBrussels` from `@/lib/utils`)
- Client pages start with `'use client'`; the browser Supabase client is `supabase` from `@/lib/supabase` (anon key, session persisted in localStorage)
- Server routes use `supabaseServer()` from `@/lib/supabase` (service role)
- Tailwind with CSS custom properties for colour; never hardcode a hex in a component
- Tailwind cannot apply an alpha to a `var()` colour — `border-[var(--x)]/30` compiles to
  nothing. Use `color-mix()` utility classes, as `globals.css` already does for the kit theme
- Long text wraps, it does not truncate
- Modals lock the page behind them with `useScrollLock` from `@/lib/useScrollLock`

## Magic link flow

`supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <origin>/voorspellingen } })`.
The session arrives in the URL hash and supabase-js picks it up automatically
(`detectSessionInUrl` is on by default), so **no server callback route is needed**.
After login, if the user has no `ucl_players` row, force the name screen before anything else.

## Owner setup still outstanding

- `FOOTBALL_API_KEY` in `.env.local` and Vercel
- Run migration 004 in the Supabase SQL editor
- Supabase: enable Email provider with magic links; Site URL and redirect allowlist must
  include `/voorspellingen`; SMTP pointed at Resend (the built-in sender is rate limited to a
  few mails an hour and will silently fail for a group)
