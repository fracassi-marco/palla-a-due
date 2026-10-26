import { liveLabel } from '../../domain/liveLabel';
import { BoxScoreSide, Match, MatchStatus, Player, TeamRef } from '../../domain/entities';
import { BoxScoreTeamDto } from '../nba/dto';
import { clockSeconds, toBoxScoreSide as toNbaBoxScoreSide, toPlayer as toNbaPlayer } from '../nba/mappers';
import { matchId } from './ids';
import { logoUrl, WnbaTeam } from './teams';
import { weekOf } from './weeks';

/**
 * Foto dei giocatori dal CDN della WNBA (non richiede intestazioni da browser). Il suffisso `?wnba` evita che la chiave del
 * manifest immagini (ultimo segmento dell'URL) coincida con quella di un giocatore NBA.
 */
export const headshotUrl = (personId: number) => `https://cdn.wnba.com/headshots/wnba/latest/260x190/${personId}.png?wnba`;

export const toTeamRef = (team: WnbaTeam): TeamRef => ({ id: team.id, name: team.name, code: team.code, logoUrl: logoUrl(team) });

/** `date` è AAAAMMGG (ora della costa Est). Il punteggio c'è solo a partita iniziata. */
export function toMatch(
  competition: number,
  firstMonday: number,
  date: string,
  home: WnbaTeam,
  away: WnbaTeam,
  status: MatchStatus,
  startsAt: Date,
  score: { home: number; away: number },
  venue: { name: string; city: string } | null,
  live: { period: number; clock: string } | null = null,
): Match {
  const week = weekOf(firstMonday, date);
  const started = status !== 'scheduled';
  return {
    id: matchId(date, home, away),
    status,
    startsAt,
    home: toTeamRef(home),
    away: toTeamRef(away),
    homeScore: started ? score.home : null,
    awayScore: started ? score.away : null,
    venue: venue?.name || null,
    city: venue?.city || null,
    dayNumber: week,
    dayName: `Settimana ${week}`,
    hasStreaming: false,
    liveLabel: status === 'live' && live ? liveLabel(live.period, clockSeconds(live.clock)) : null,
  };
}

/** I dati di box score e anagrafica sono quelli della NBA, con le foto del CDN della WNBA. */
export const toBoxScoreSide = (team: BoxScoreTeamDto): BoxScoreSide => toNbaBoxScoreSide(team, headshotUrl);

export const toPlayer = (row: Record<string, string | number | null>, team: TeamRef): Player => toNbaPlayer(row, team, headshotUrl);
