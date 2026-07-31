This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## RBFA sync

Supabase is the source of truth; RBFA is only a feed. `lib/rbfa.mjs` is the single place
that talks to the RBFA datalake and it only ever inserts or updates — nothing is deleted,
and a value we already have is never overwritten with null. That matters because RBFA
prunes: `matchDetail` returns `null` for past seasons, `teamCalendar` empties out, and
`teamMembers` is `null` until a squad is published. Whatever we captured, we keep.

**RBFA mints a new `teamId` every season.** The `clubId` (`9143`) is stable, so the team id
is resolved at sync time via `clubTeams(clubId)`. Team ids from earlier seasons are read
back out of the `matches` table, so past seasons keep getting refreshed too. Never hardcode
a team id — that is exactly what made the 2026-27 calendar invisible.

- `POST /api/sync` — the "Sync RBFA" button.
- `GET /api/sync` — the scheduled run; requires `Authorization: Bearer $CRON_SECRET`.
- `node scripts/check-rbfa.mjs` — hits the live API and asserts the club still resolves to
  a non-empty calendar plus the state/timezone rules. Run it when something looks stale.

Scheduling lives in Supabase pg_cron (every 15 min) rather than Vercel Cron, so the
interval isn't capped by the Vercel plan: fill in the placeholders in `supabase/cron.sql`
and run it once in the SQL editor. Migrations in `supabase/migrations/` are applied by hand
in the same editor.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources below:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
