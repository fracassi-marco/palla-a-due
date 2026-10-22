import { Competition, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { LeagueSource, MatchRepository } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { nameOverlap } from './teamNames';

/** Chiave di prova pubblica di TheSportsDB: ha un limite di richieste basso, per questo la fonte è serializzata e in cache. */
const API_URL = 'https://www.thesportsdb.com/api/v1/json/123';
const MIN_GAP_MS = 1_500;
const ROUND_TTL_MS = 60_000;
/** Una partita nota e un evento sono la stessa se la loro data differisce al più di così. */
const MAX_DATE_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const FINISHED = new Set(['FT', 'AOT']);

interface EventDto {
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  /** UTC, senza suffisso. */
  strTimestamp: string | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const unavailable = () => new Error('Dato non disponibile da TheSportsDB');

/**
 * Backup di calendario e punteggi per i campionati che hanno una sola fonte (LBA, Serie A2). TheSportsDB ha id propri e non ha
 * box score né roster: non può creare partite o squadre, ma aggiorna stato e punteggio di quelle già nel database
 * (abbinate per nome delle squadre), così durante un guasto i risultati restano aggiornati.
 */
export class TheSportsDbLeagueSource implements LeagueSource {
  private readonly rounds = new Map<string, { at: number; events: Promise<EventDto[]> }>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly http: HttpClient,
    private readonly matches: MatchRepository,
    private readonly leagueId: number,
    private readonly seasonYear: () => number,
  ) {}

  async findRegularSeasons(_seasonYear: number): Promise<Competition[]> {
    throw unavailable();
  }

  async getBoxScore(_matchId: number): Promise<MatchBoxScore> {
    throw unavailable();
  }

  async getRoster(_teamId: number): Promise<Roster> {
    throw unavailable();
  }

  async getDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const known = await this.matches.getMatchesByDay(competitionId, dayNumber);
    if (known.length === 0) throw new Error('Calendario non ancora scaricato: nessuna partita da aggiornare');

    const events = await this.round(dayNumber);
    const paired = pair(known, events);
    return known.map((match) => {
      const event = paired.get(match.id);
      return event ? withResult(match, event) : match;
    });
  }

  private round(dayNumber: number): Promise<EventDto[]> {
    const season = this.seasonYear();
    const key = `${season}-${dayNumber}`;
    const cached = this.rounds.get(key);
    if (cached && Date.now() - cached.at < ROUND_TTL_MS) return cached.events;

    const events = this.turn().then(async () => {
      const response = await this.http.get<{ events: EventDto[] | null }>(`${API_URL}/eventsround.php`, {
        id: this.leagueId,
        r: dayNumber,
        s: `${season}-${season + 1}`,
      });
      return response.events ?? [];
    });
    const entry = { at: Date.now(), events };
    this.rounds.set(key, entry);
    events.catch(() => {
      if (this.rounds.get(key) === entry) this.rounds.delete(key);
    });
    return events;
  }

  /** Le richieste partono una alla volta, distanziate. */
  private turn(): Promise<void> {
    const ticket = this.queue.then(() => sleep(MIN_GAP_MS));
    this.queue = ticket;
    return ticket;
  }
}

const startsAt = (event: EventDto) => (event.strTimestamp ? Date.parse(`${event.strTimestamp}Z`) : NaN);

/** Abbina a ogni partita nota l'evento con più parole dei nomi in comune (casa e ospiti); se ne resta una per parte, vicine nel tempo, sono la stessa. */
function pair(known: Match[], events: EventDto[]): Map<number, EventDto> {
  const result = new Map<number, EventDto>();
  const free = new Set(events);
  const candidates = known.flatMap((match) =>
    events.flatMap((event) => {
      const home = nameOverlap(match.home.name, event.strHomeTeam);
      const away = nameOverlap(match.away.name, event.strAwayTeam);
      return home > 0 && away > 0 ? [{ match, event, score: home + away }] : [];
    }),
  );
  for (const { match, event } of candidates.sort((a, b) => b.score - a.score)) {
    if (result.has(match.id) || !free.has(event)) continue;
    result.set(match.id, event);
    free.delete(event);
  }

  const left = known.filter((m) => !result.has(m.id));
  if (left.length === 1 && free.size === 1) {
    const [event] = free;
    if (Math.abs(startsAt(event) - left[0].startsAt.getTime()) <= MAX_DATE_GAP_MS) result.set(left[0].id, event);
  }
  return result;
}

/** Risultato concluso, oppure punteggio di una partita già iniziata; altrimenti la partita resta com'è. */
function withResult(match: Match, event: EventDto): Match {
  const home = event.intHomeScore === null ? NaN : Number(event.intHomeScore);
  const away = event.intAwayScore === null ? NaN : Number(event.intAwayScore);
  if (match.status === 'finished' || Number.isNaN(home) || Number.isNaN(away)) return match;
  if (match.status === 'scheduled' && Date.now() < match.startsAt.getTime()) return match;
  const finished = FINISHED.has(event.strStatus ?? '');
  return { ...match, status: finished ? 'finished' : 'live', homeScore: home, awayScore: away };
}
