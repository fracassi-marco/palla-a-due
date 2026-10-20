import { Standing, TeamRef } from './entities';

/** Una partita conclusa dal punto di vista di una squadra. */
export interface TeamGame {
  teamId: number;
  opponentId: number;
  teamScore: number;
  opponentScore: number;
}

/** Posti playoff e retrocessione, come li marca la Lega nella sua classifica (0 = nessuna zona). */
export interface StandingsZones {
  playoffSpots: number;
  relegationSpots: number;
}

interface Row {
  team: TeamRef;
  played: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
}

const leaguePoints = (wins: number) => 2 * wins;

function tally(teams: TeamRef[], games: TeamGame[]): Row[] {
  const rows = new Map<number, Row>(
    teams.map((team) => [team.id, { team, played: 0, wins: 0, pointsFor: 0, pointsAgainst: 0 }]),
  );
  for (const g of games) {
    const row = rows.get(g.teamId);
    if (!row) continue;
    row.played++;
    if (g.teamScore > g.opponentScore) row.wins++;
    row.pointsFor += g.teamScore;
    row.pointsAgainst += g.opponentScore;
  }
  return [...rows.values()];
}

/**
 * Ordina le squadre: punti, poi tra pari merito punti e differenza canestri negli scontri diretti,
 * poi differenza canestri generale, poi punti fatti. Semplificazione rispetto al regolamento:
 * con più squadre a pari merito gli scontri diretti non vengono ricalcolati ricorsivamente.
 */
function rank(rows: Row[], games: TeamGame[]): Row[] {
  const byPoints = new Map<number, Row[]>();
  for (const row of rows) {
    const points = leaguePoints(row.wins);
    byPoints.set(points, [...(byPoints.get(points) ?? []), row]);
  }

  const keyed = rows.map((row) => {
    const group = byPoints.get(leaguePoints(row.wins)) ?? [];
    const ids = new Set(group.map((r) => r.team.id));
    let h2hWins = 0;
    let h2hDiff = 0;
    if (group.length > 1) {
      for (const g of games) {
        if (g.teamId !== row.team.id || !ids.has(g.opponentId)) continue;
        if (g.teamScore > g.opponentScore) h2hWins++;
        h2hDiff += g.teamScore - g.opponentScore;
      }
    }
    return { row, key: [leaguePoints(row.wins), leaguePoints(h2hWins), h2hDiff, row.pointsFor - row.pointsAgainst, row.pointsFor] };
  });

  keyed.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i];
    return a.row.team.name.localeCompare(b.row.team.name);
  });
  return keyed.map((k) => k.row);
}

/**
 * Classifica calcolata dalle partite concluse. Punti, vittorie e canestri coincidono con quelli ufficiali;
 * le penalizzazioni di punti non sono ricavabili dai risultati, e tra tre o più squadre a pari merito
 * l'ordine può differire da quello della Lega (vedi `rank`).
 */
export function computeStandings(teams: TeamRef[], games: TeamGame[], zones: StandingsZones): Standing[] {
  return rank(tally(teams, games), games).map((row, i) => {
    const position = i + 1;
    const losses = row.played - row.wins;
    return {
      position,
      team: row.team,
      played: row.played,
      wins: row.wins,
      losses,
      points: leaguePoints(row.wins),
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      avgPointsFor: row.played > 0 ? row.pointsFor / row.played : 0,
      avgPointsAgainst: row.played > 0 ? row.pointsAgainst / row.played : 0,
      playoffQualified: position <= zones.playoffSpots,
      relegation: zones.relegationSpots > 0 && position > teams.length - zones.relegationSpots,
    };
  });
}
