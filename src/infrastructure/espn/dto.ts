/** Forma dei dati del tabellone di ESPN letti per i playoff (solo i campi usati); è la stessa per NBA e WNBA. */
export interface EspnPlayoffEventDto {
  date: string;
  /** 1 = precampionato, 2 = Regular Season, 3 = playoff. */
  season: { type: number };
  competitions: {
    competitors: { homeAway: 'home' | 'away'; team: { id: string; abbreviation: string } }[];
    /** Turno e partita: "First Round - Game 1", "WNBA Finals - Game 7 If Necessary". */
    notes?: { headline?: string }[];
    series?: { totalCompetitions: number; completed: boolean; competitors: { id: string; wins: number }[] };
    status: { type: { state: 'pre' | 'in' | 'post' } };
  }[];
}

export interface EspnPlayoffScoreboardDto {
  events: EspnPlayoffEventDto[];
}
