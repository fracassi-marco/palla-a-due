/** Forma dei dati di ESPN per la WNBA (solo i campi letti dall'app). */
export interface EspnTeamDto {
  id: string;
  abbreviation: string;
  displayName: string;
}

export interface EspnCompetitorDto {
  homeAway: 'home' | 'away';
  score?: string;
  team: EspnTeamDto;
}

export interface EspnEventDto {
  id: string;
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

export interface EspnBoxScoreAthleteDto {
  athlete: { id: string; firstName?: string; lastName?: string; displayName: string; jersey?: string };
  starter: boolean;
  didNotPlay: boolean;
  /** Valori nell'ordine di `keys` ("33-67" per tiri segnati-tentati). */
  stats: string[];
}

export interface EspnBoxScoreSideDto {
  team: { id: string };
  statistics: { keys: string[]; athletes: EspnBoxScoreAthleteDto[]; totals: string[] }[];
}

export interface EspnSummaryDto {
  boxscore: { players?: EspnBoxScoreSideDto[] };
  header: { competitions: { competitors: { homeAway: 'home' | 'away'; team: { id: string } }[] }[] };
}

export interface EspnRosterAthleteDto {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  /** Pollici. */
  height?: number;
  /** Libbre. */
  weight?: number;
  dateOfBirth?: string;
  birthPlace?: { city?: string; state?: string; country?: string };
  jersey?: string;
  position?: { abbreviation: string };
}

export interface EspnRosterDto {
  team: EspnTeamDto;
  coach?: { id: string; firstName: string; lastName: string }[];
  athletes: EspnRosterAthleteDto[];
}
