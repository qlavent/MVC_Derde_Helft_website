import { toRow } from '@/lib/ucl/api.mjs'
import { formatBrussels } from '@/lib/utils'

// A plain page that shows what football-data.org returns RIGHT NOW. It reads only the football
// API — never the database — so it changes nothing and is safe to open any time. Its purpose is
// to see whether the provider has corrected a score (e.g. AEK 2-0 that should be 1-0).
export const dynamic = 'force-dynamic'

type Row = {
  id: number
  utc_kickoff: string
  home_team: string
  away_team: string
  status: string
  home_score: number | null
  away_score: number | null
}

async function getRows(): Promise<Row[]> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_API_KEY is not set')
  const res = await fetch('https://api.football-data.org/v4/competitions/CL/matches', {
    headers: { 'X-Auth-Token': apiKey },
    // Cache the upstream response for 60s so many page loads still cost at most one API call
    // per minute, well inside the free tier.
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`football-data ${res.status}`)
  const json = await res.json()
  return (json.matches ?? []).map(toRow) as Row[]
}

export default async function UclApiCheckPage({
  searchParams,
}: {
  searchParams: { team?: string }
}) {
  const team = (searchParams.team ?? '').toLowerCase()

  let rows: Row[] = []
  let error: string | null = null
  try {
    rows = await getRows()
  } catch (e) {
    error = String(e)
  }

  const now = Date.now()
  const shown = rows
    .filter(
      (r) =>
        !team ||
        r.home_team.toLowerCase().includes(team) ||
        r.away_team.toLowerCase().includes(team)
    )
    // Without a team filter, keep the list short: live, upcoming soon, or finished recently.
    .filter((r) => {
      if (team) return true
      const t = new Date(r.utc_kickoff).getTime()
      return t > now - 2 * 24 * 3600_000 && t < now + 2 * 24 * 3600_000
    })
    .sort((a, b) => new Date(a.utc_kickoff).getTime() - new Date(b.utc_kickoff).getTime())

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Live API-scores</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Rechtstreeks van football-data.org. De database wordt niet gelezen of gewijzigd.
        {' '}Ververst maximaal één keer per minuut.
      </p>

      <form method="get" style={{ marginBottom: 16 }}>
        <input
          type="text"
          name="team"
          defaultValue={searchParams.team ?? ''}
          placeholder="Filter op ploeg, bv. AEK"
          style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, width: 220, fontSize: 14 }}
        />
        <button type="submit" style={{ marginLeft: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, cursor: 'pointer' }}>
          Zoek
        </button>
      </form>

      {error ? (
        <p style={{ color: '#c00' }}>Fout bij ophalen: {error}</p>
      ) : shown.length === 0 ? (
        <p style={{ color: '#666' }}>Geen wedstrijden gevonden{team ? ` voor “${team}”` : ''}.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '8px 6px' }}>Aftrap (Brussel)</th>
              <th style={{ padding: '8px 6px' }}>Wedstrijd</th>
              <th style={{ padding: '8px 6px' }}>Status</th>
              <th style={{ padding: '8px 6px', textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', color: '#666' }}>
                  {formatBrussels(r.utc_kickoff, 'EEE d MMM · HH:mm')}
                </td>
                <td style={{ padding: '8px 6px' }}>
                  {r.home_team} <span style={{ color: '#999' }}>vs</span> {r.away_team}
                </td>
                <td style={{ padding: '8px 6px', color: '#666' }}>{r.status}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {r.home_score == null ? '–' : `${r.home_score} - ${r.away_score}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>
        Opgehaald: {formatBrussels(new Date(), 'd MMM HH:mm:ss')} (Brusselse tijd).
      </p>
    </main>
  )
}
