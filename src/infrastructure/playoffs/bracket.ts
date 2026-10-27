import { PlayoffBracket, PlayoffRound, PlayoffSeries, TeamRef } from '../../domain/entities';

/** Un turno del tabellone: le fonti pubblicano una serie solo quando è definita, quindi `slots` dice quante ne sono previste. */
export interface PlayoffRoundConfig {
  name: string;
  /** Partite per vincere la serie al meglio di `bestOf`. */
  bestOf: number;
  slots: number;
}

export interface PlayoffGameTeam {
  team: TeamRef;
  /** Testa di serie, se la fonte la dà. */
  seed: number | null;
  /** Vittorie della serie dopo questa partita (o prima, se non è ancora giocata). */
  seriesWins: number;
}

/** Una partita di playoff nella forma comune alle fonti: `round` è l'indice del turno in `PlayoffRoundConfig[]`. */
export interface PlayoffGame {
  round: number;
  startsAt: Date;
  state: 'pre' | 'in' | 'post';
  home: PlayoffGameTeam;
  away: PlayoffGameTeam;
}

/**
 * Costruisce il tabellone dalle partite: le raggruppa per turno e coppia di squadre in serie, che mette in ordine di tabellone.
 * La squadra in alto di una serie è quella che gioca in casa gara 1.
 */
export function buildBracket(games: PlayoffGame[], rounds: PlayoffRoundConfig[]): PlayoffBracket {
  const byRound = rounds.map(() => new Map<string, PlayoffGame[]>());
  for (const game of [...games].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    if (!byRound[game.round]) continue;
    const key = [game.home.team.id, game.away.team.id].sort().join('-');
    byRound[game.round].set(key, [...(byRound[game.round].get(key) ?? []), game]);
  }

  const built = byRound.map((groups, i) => [...groups.values()].map((g) => toSeries(g, rounds[i].bestOf)));
  const ordered = alignWithNextRound(built);
  return {
    rounds: rounds.map((round, i): PlayoffRound => ({
      name: round.name,
      series: Array.from({ length: round.slots }, (_, slot) => ordered[i][slot] ?? null),
    })),
  };
}

/** Una serie dalle sue partite, in ordine di data. */
function toSeries(games: PlayoffGame[], bestOf: number): PlayoffSeries {
  const [first, last] = [games[0], games[games.length - 1]];
  const top = first.home;
  const bottom = first.away;
  // Il conteggio vittorie è quello dell'ultima partita (le fonti lo aggiornano a ogni gara).
  const winsOf = (team: PlayoffGameTeam) => [last.home, last.away].find((t) => t.team.id === team.team.id)?.seriesWins ?? 0;
  const topWins = winsOf(top);
  const bottomWins = winsOf(bottom);
  const needed = Math.ceil(bestOf / 2);
  const decided = topWins >= needed || bottomWins >= needed;

  const next = games.find((g) => g.state === 'pre');
  return {
    id: `${top.team.id}-${bottom.team.id}`,
    top: top.team,
    bottom: bottom.team,
    topSeed: top.seed,
    bottomSeed: bottom.seed,
    topWins,
    bottomWins,
    bestOf,
    winnerId: decided ? (topWins > bottomWins ? top.team.id : bottom.team.id) : null,
    live: games.some((g) => g.state === 'in'),
    nextGameAt: next && !decided ? next.startsAt : null,
  };
}

/** Le serie di un turno vanno una accanto all'altra se alimentano la stessa serie del turno dopo: si ordinano per dove va il vincitore. */
function alignWithNextRound(rounds: PlayoffSeries[][]): PlayoffSeries[][] {
  const ordered = rounds.map((series) => [...series]);
  for (let i = rounds.length - 2; i >= 0; i--) {
    const next = ordered[i + 1];
    const target = (series: PlayoffSeries) => {
      const found = next.findIndex((n) => [n.top.id, n.bottom.id].some((id) => id === series.top.id || id === series.bottom.id));
      return found < 0 ? Infinity : found;
    };
    ordered[i].sort((a, b) => target(a) - target(b));
  }
  return ordered;
}
