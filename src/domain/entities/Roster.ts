import { Player } from './Player';
import { TeamRef } from './Team';

export interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

export interface Roster {
  team: TeamRef;
  coach: Coach | null;
  players: Player[];
}
