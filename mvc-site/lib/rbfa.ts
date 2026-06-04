const RBFA_API = 'https://datalake-prod2018.rbfa.be/graphql'
export const TEAM_ID = '345149'
export const OUR_TEAM_RBFA_ID = '345149'

export async function rbfaQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(RBFA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

export const CALENDAR_QUERY = `
  query {
    teamCalendar(teamId: "${TEAM_ID}", language: nl, sortByDate: asc) {
      id state startTime
      homeTeam { id name }
      awayTeam { id name }
      outcome { homeTeamGoals awayTeamGoals }
      series { id name }
    }
  }
`

export const MEMBERS_QUERY = `
  query {
    teamMembers(teamId: "${TEAM_ID}", language: nl) {
      players { id firstName lastName }
    }
  }
`
