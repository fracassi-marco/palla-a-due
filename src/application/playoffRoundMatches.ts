import { Match, PlayoffBracket } from '../domain/entities';
import { latestAndNextNight } from './GetCurrentRound';

/**
 * Le gare del turno di playoff in corso, nella forma del carosello: il turno è l'ultimo con serie avviate e di
 * quelle gare restano le live, le ultime concluse e le prossime.
 */
export function playoffRoundMatches(bracket: PlayoffBracket): Match[] {
  const current = bracket.rounds.findLast((r) => r.series.some((s) => s && (s.games?.length ?? 0) > 0));
  if (!current) return [];

  const matches = current.series.flatMap((series) =>
    (series?.games ?? []).map((g): Match => ({
      // Senza id nel database (leghe che non salvano i playoff) l'id è sintetico e negativo, e la card non si apre.
      id: g.matchId ?? -(series!.top.id * 1000 + series!.bottom.id) * 10 - g.number,
      status: g.status,
      startsAt: g.startsAt,
      home: g.home,
      away: g.away,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      venue: null,
      city: null,
      dayNumber: g.number,
      dayName: series!.bestOf === 1 ? current.name : `${current.name} · GARA ${g.number}`,
      hasStreaming: false,
      liveLabel: null,
    })),
  );
  return latestAndNextNight(matches).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
