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
}
