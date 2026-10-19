const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Durata di validità (ms) di una risposta, in base all'endpoint e al suo contenuto. */
export type TtlPolicy = (path: string, data: unknown) => number;

interface CalendarLike {
  matches?: { game_status: string; match_datetime: string }[] | null;
}

interface BoxScoreLike {
  scores?: { ht?: { rows?: unknown[] | null } | null; vt?: { rows?: unknown[] | null } | null } | null;
}

const LIVE_TTL = 30 * SECOND;

/** Giornata conclusa: immutabile. In corso: dati live. Da giocare: scade al più tardi alla palla a due. */
function calendarTtl(data: unknown, now: number): number {
  const matches = (data as CalendarLike).matches ?? [];
  if (matches.length === 0) return 5 * MINUTE;
  if (matches.every((m) => m.game_status === '2')) return 7 * DAY;
  if (matches.some((m) => m.game_status === '1')) return LIVE_TTL;

  const nextStart = Math.min(...matches.filter((m) => m.game_status !== '2').map((m) => new Date(m.match_datetime).getTime()));
  const untilStart = nextStart - now;
  return Math.min(Math.max(untilStart, LIVE_TTL), 30 * MINUTE);
}

/** L'API non espone lo stato nel box score: vuoto = non ancora disponibile, altrimenti potrebbe essere live. */
function boxScoreTtl(data: unknown): number {
  const scores = (data as BoxScoreLike).scores;
  const hasRows = Boolean(scores?.ht?.rows?.length || scores?.vt?.rows?.length);
  return hasRows ? MINUTE : LIVE_TTL;
}

export const defaultTtlPolicy: TtlPolicy = (path, data) => {
  switch (path) {
    case '/championships/get-championships':
      return DAY;
    case '/championships/get-championship-ranking':
      return 15 * MINUTE;
    case '/championships/get-championships-calendar-by-id':
      return calendarTtl(data, Date.now());
    case '/championships/get-championships-matches-scores-by-id':
      return boxScoreTtl(data);
    case '/teams/get-team-roster':
      return 12 * HOUR;
    case '/teams/get-team-stats':
    case '/teams/get-team-matches-stats':
      return 15 * MINUTE;
    case '/players/get-player-stats':
    case '/players/get-player-matches':
      return HOUR;
    default:
      return 0;
  }
};
