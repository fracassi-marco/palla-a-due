import { BoxScore, BoxScoreSide, GameStats, MatchBoxScore, StatLine } from './entities';

const toStatLine = (s: GameStats): StatLine => ({
  points: s.points,
  minutes: s.minutes,
  matches: 1,
  twoMade: s.twoMade,
  twoAttempted: s.twoAttempted,
  threeMade: s.threeMade,
  threeAttempted: s.threeAttempted,
  freeThrowsMade: s.freeThrowsMade,
  freeThrowsAttempted: s.freeThrowsAttempted,
  offensiveRebounds: s.offensiveRebounds,
  defensiveRebounds: s.defensiveRebounds,
  totalRebounds: s.totalRebounds,
  assists: s.assists,
  steals: s.steals,
  turnovers: s.turnovers,
  blocks: s.blocks,
  fouls: s.fouls,
  rating: s.rating,
});

const sideLines = (side: BoxScoreSide): Record<number, StatLine> =>
  Object.fromEntries(side.players.map((p) => [p.id, toStatLine(p.stats)]));

/** Box score scaricato nella forma letta dalle schermate: statistiche per id giocatore. */
export const toBoxScore = (box: MatchBoxScore): BoxScore => ({
  home: sideLines(box.home),
  away: sideLines(box.away),
});
