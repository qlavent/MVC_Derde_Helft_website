// Dutch names for a Champions League round, in one place.
//
// Three screens need this — Wedstrijden, Resultaten and Mij — and when each grew its own copy
// they immediately disagreed: the same play-off tie read "Tussenronde" on one screen,
// "Play-offs" on another and "Play-offs — heen" on a third. One implementation, so a round is
// called the same thing everywhere.
//
// Vocabulary covers both the format introduced in 2024 (LEAGUE_STAGE, PLAYOFFS) and the older
// one (GROUP_STAGE), because ucl_matches keeps finished seasons and the history screens read
// them back.

const LEAGUE_STAGES = new Set(['LEAGUE_STAGE', 'GROUP_STAGE'])

const STAGE_LABELS = {
  PRELIMINARY_ROUND: 'Voorronde',
  FIRST_QUALIFYING_ROUND: 'Eerste voorronde',
  SECOND_QUALIFYING_ROUND: 'Tweede voorronde',
  THIRD_QUALIFYING_ROUND: 'Derde voorronde',
  PLAY_OFF_ROUND: 'Play-offs',
  PLAYOFF_ROUND: 'Play-offs',
  PLAYOFFS: 'Play-offs',
  ROUND_OF_16: 'Achtste finales',
  LAST_16: 'Achtste finales',
  QUARTER_FINAL: 'Kwartfinales',
  QUARTER_FINALS: 'Kwartfinales',
  SEMI_FINAL: 'Halve finales',
  SEMI_FINALS: 'Halve finales',
  THIRD_PLACE: 'Troostfinale',
  FINAL: 'Finale',
}

export function isLeagueStage(stage) {
  return LEAGUE_STAGES.has(stage)
}

/**
 * The heading for a group of matches.
 *
 * The league phase numbers its matchdays, so it reads "Speeldag 3". Knockout rounds do not, so
 * they take the round's name — and when a two-legged tie carries a matchday, the leg is spelled
 * out, because otherwise a picker lists "Achtste finales" twice with nothing to tell them apart.
 */
export function matchdayLabel(stage, matchday) {
  if (isLeagueStage(stage)) {
    return matchday != null ? `Speeldag ${matchday}` : 'Competitiefase'
  }

  const name = stage ? STAGE_LABELS[stage] : undefined
  if (name) {
    if (matchday == null) return name
    if (matchday === 1) return `${name} — heen`
    if (matchday === 2) return `${name} — terug`
    return `${name} — deel ${matchday}`
  }

  if (matchday != null) return `Speeldag ${matchday}`

  // An unknown stage should still read as words, not as SCREAMING_SNAKE.
  if (stage) {
    const words = stage.replace(/_/g, ' ').toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
  }
  return 'Wedstrijden'
}
