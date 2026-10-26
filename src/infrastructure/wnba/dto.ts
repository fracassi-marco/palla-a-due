/** Forma dei dati del tabellone di ESPN per la WNBA, il backup (solo i campi letti dall'app). */
export interface EspnCompetitorDto {
  homeAway: 'home' | 'away';
  score?: string;
  team: { abbreviation: string };
}

export interface EspnEventDto {
  date: string;
  /** 1 = precampionato, 2 = Regular Season, 3 = playoff. */
  season: { type: number };
  competitions: {
    /** "STD" = partita normale; "CC" = finale della Commissioner's Cup, "ALLSTAR" = All-Star Game: non contano in classifica. */
    type: { abbreviation: string };
    competitors: EspnCompetitorDto[];
    venue?: { fullName?: string; address?: { city?: string } };
    status: { period: number; displayClock: string; type: { name: string; state: 'pre' | 'in' | 'post' } };
  }[];
}

export interface EspnScoreboardDto {
  events: EspnEventDto[];
}
