import { TeamRef } from './Team';

/** Classifica di una competizione: la Serie B Nazionale ne ha una per girone. */
export interface StandingsGroup {
  competitionId: number;
  name: string;
  standings: Standing[];
}

export interface Standing {
  position: number;
  team: TeamRef;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Vittorie / partite giocate (0-1). */
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  playoffQualified: boolean;
  /** Posto di spareggio (play-in) subito dopo quelli playoff. */
  playIn: boolean;
  relegation: boolean;
}
