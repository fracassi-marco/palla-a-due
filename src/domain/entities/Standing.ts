import { TeamRef } from './Team';

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
