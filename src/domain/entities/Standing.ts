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
  pointsFor: number;
  pointsAgainst: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  playoffQualified: boolean;
  relegation: boolean;
}
