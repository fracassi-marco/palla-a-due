import { TeamRef } from './Team';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match {
  id: number;
  status: MatchStatus;
  startsAt: Date;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  city: string | null;
  dayNumber: number;
  dayName: string;
  hasStreaming: boolean;
  /** Dove si è arrivati, a partita live ("Q2 5:32", "Intervallo"); null se la fonte non lo dà. */
  liveLabel: string | null;
}
