import {
  BoxScorePlayer,
  BoxScoreSide,
  Competition,
  GameStats,
  Match,
  MatchBoxScore,
  MatchStatus,
  Player,
  Roster,
  TeamRef,
} from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { romeToDate } from '../lnp/mappers';
import { clubId, competitionId, decodeCompetitionId, decodeMatchId, matchId, personId, seasonCode } from './ids';
import { LiveFeed } from './LiveFeed';
import { splitName, titleCase } from './mappers';
import { EuroleagueSeries } from './series';
import { attributeRecords, attributes, section, textRecords } from './xml';

const API_URL = 'https://api-live.euroleague.net/v1';
const SEASON_TTL_MS = 10_000;
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ROLES: Record<string, string> = { Guard: 'Guardia', Forward: 'Ala', Center: 'Centro' };

type Fields = Record<string, string>;

interface ClubInfo {
  code: string;
  tvCode: string;
  name: string;
  coach: Fields | null;
  players: Fields[];
}

interface Season {
  /** Elementi del calendario della fase a gironi. */
  games: Fields[];
  /** Punteggi delle partite giocate, per numero di gara. */
  scores: Map<number, { home: number; away: number }>;
}

const gameCodeOf = (game: Fields) => Number(game.gamecode.split('_')[1]);

/** "Sep 24, 2026" e "20:15" (ora dell'Europa centrale) → istante. */
function startOf(game: Fields): Date {
  const [month, day, year] = game.date.replace(',', '').split(' ');
  const rome = `${day}/${MONTHS.indexOf(month.toLowerCase()) + 1}/${year}`;
  return romeToDate(rome, game.startime) ?? new Date(NaN);
}

/**
 * Backup di EuroleagueLeagueSource: la vecchia API v1 (XML, stessi dati, stessi id). Non ha le foto (né logo, altezza, data di
 * nascita) e gira sullo stesso server: protegge da un guasto o da un cambio di formato della v2, non da un blocco del server.
 */
export class EuroleagueV1LeagueSource implements LeagueSource {
  private season: { year: number; at: number; data: Promise<Season> } | null = null;
  private clubs: Promise<Map<number, ClubInfo>> | null = null;
  private readonly live: LiveFeed;

  constructor(
    private readonly http: HttpClient,
    private readonly series: EuroleagueSeries,
    private readonly seasonYear: () => number,
  ) {
    this.live = new LiveFeed(http, series);
  }

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const orders = groupOrders((await this.loadSeason(seasonYear)).games);
    return [...orders].map(([group, order]) => ({
      id: competitionId(seasonYear, order),
      name: orders.size === 1 ? this.series.name : `Girone ${group}`,
      year: seasonYear,
    }));
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const { seasonYear, groupOrder } = decodeCompetitionId(competition);
    const { games, scores } = await this.loadSeason(seasonYear);
    const orders = groupOrders(games);
    const clubs = await this.loadClubs().catch(() => new Map<number, ClubInfo>());
    const now = Date.now();
    const day = games.filter((g) => orders.get(g.group) === groupOrder && Number(g.gameday) === dayNumber);
    return Promise.all(
      day.map(async (g) => {
        const gameCode = gameCodeOf(g);
        const startsAt = startOf(g);
        const status = toStatus(g, now, startsAt.getTime());
        let score = scores.get(gameCode);
        if (status === 'live') score = (await this.live.score(seasonYear, gameCode)) ?? score;
        const started = status !== 'scheduled';
        return {
          id: matchId(competition, gameCode),
          status,
          startsAt,
          home: toTeamRef(g.homecode, g.hometv, g.hometeam, clubs),
          away: toTeamRef(g.awaycode, g.awaytv, g.awayteam, clubs),
          homeScore: started ? (score?.home ?? 0) : null,
          awayScore: started ? (score?.away ?? 0) : null,
          venue: g.arenaname ? titleCase(g.arenaname) : null,
          city: null,
          dayNumber,
          dayName: `Giornata ${dayNumber}`,
          hasStreaming: false,
        };
      }),
    );
  }

  async getBoxScore(id: number): Promise<MatchBoxScore> {
    const { seasonYear, gameCode } = decodeMatchId(id);
    const xml = await this.http.getText(`${API_URL}/games`, { seasonCode: seasonCode(this.series.code, seasonYear), gameCode });
    const box = { home: toSide(section(xml, 'localclub')), away: toSide(section(xml, 'roadclub')) };
    if (box.home.players.length + box.away.players.length > 0) return box;
    return (await this.live.boxScore(seasonYear, gameCode)) ?? box;
  }

  async getRoster(teamId: number): Promise<Roster> {
    const club = (await this.loadClubs()).get(teamId);
    if (!club) throw new Error(`Squadra ${teamId} non trovata`);
    const team = toTeamRef(club.code, club.tvCode, club.name, new Map([[teamId, club]]));
    return {
      team,
      coach: club.coach
        ? { id: personId(club.coach.code), ...splitName(club.coach.name), photoUrl: null }
        : null,
      players: club.players.map((p): Player => ({
        id: personId(p.code),
        ...splitName(p.name),
        number: p.dorsal || '-',
        role: ROLES[p.position] ?? p.position ?? '',
        country: p.countryname ?? '',
        birthDate: null,
        birthPlace: null,
        heightCm: null,
        weightKg: null,
        photoUrl: null,
        teamId: team.id,
        teamName: team.name,
      })),
    };
  }

  private loadSeason(seasonYear: number): Promise<Season> {
    const now = Date.now();
    if (this.season?.year === seasonYear && now - this.season.at < SEASON_TTL_MS) return this.season.data;

    const params = { seasonCode: seasonCode(this.series.code, seasonYear) };
    const data = Promise.all([
      this.http.getText(`${API_URL}/schedules`, params),
      this.http.getText(`${API_URL}/results`, params),
    ]).then(([schedule, results]): Season => ({
      games: textRecords(schedule, 'item').filter((g) => g.round === 'RS'),
      scores: new Map(
        textRecords(results, 'game')
          .filter((g) => g.played === 'true')
          .map((g) => [gameCodeOf(g), { home: Number(g.homescore), away: Number(g.awayscore) }]),
      ),
    }));
    const entry = { year: seasonYear, at: now, data };
    this.season = entry;
    data.catch(() => {
      if (this.season === entry) this.season = null;
    });
    return data;
  }

  private loadClubs(): Promise<Map<number, ClubInfo>> {
    this.clubs ??= this.http
      .getText(`${API_URL}/teams`, { seasonCode: seasonCode(this.series.code, this.seasonYear()) })
      .then((xml) => {
        const clubs = new Map<number, ClubInfo>();
        for (const [, source, body] of xml.matchAll(/<club\s([^>]*)>([\s\S]*?)<\/club>/g)) {
          const { code, tvcode } = attributes(source);
          const members = attributeRecords(body, 'member').filter((m) => m.profile === 'J' && m.active === 'true');
          clubs.set(clubId(code), {
            code,
            tvCode: tvcode || code,
            name: section(body, 'name'),
            coach: attributeRecords(body, 'coach')[0] ?? null,
            players: members.length > 0 ? members : attributeRecords(section(body, 'roster'), 'player'),
          });
        }
        return clubs;
      })
      .catch((error) => {
        this.clubs = null;
        throw error;
      });
    return this.clubs;
  }
}

/** Ai gironi (lettere A, B…) l'ordine alfabetico dà lo stesso numero d'ordine della v2; una fase unica ("Regular Season") è il girone 1. */
function groupOrders(games: Fields[]): Map<string, number> {
  const names = [...new Set(games.map((g) => g.group))].sort();
  return new Map(names.map((name, index) => [name, index + 1]));
}

function toStatus(game: Fields, now: number, startsAt: number): MatchStatus {
  if (game.played === 'true') return 'finished';
  return now >= startsAt && now < startsAt + LIVE_WINDOW_MS ? 'live' : 'scheduled';
}

function toTeamRef(code: string, tvCode: string, scheduleName: string, clubs: Map<number, ClubInfo>): TeamRef {
  const id = clubId(code);
  return { id, name: clubs.get(id)?.name || titleCase(scheduleName), code: tvCode || code, logoUrl: null };
}

const n = (fields: Fields, key: string) => Number(fields[key]) || 0;

function toStats(f: Fields): GameStats {
  return {
    minutes: Math.floor(n(f, 'TimePlayedSeconds') / 60),
    points: n(f, 'Score'),
    fouls: n(f, 'FoulsCommited'),
    foulsDrawn: n(f, 'FoulsReceived'),
    twoMade: n(f, 'FieldGoalsMade2'),
    twoAttempted: n(f, 'FieldGoalsAttempted2'),
    threeMade: n(f, 'FieldGoalsMade3'),
    threeAttempted: n(f, 'FieldGoalsAttempted3'),
    freeThrowsMade: n(f, 'FreeThrowsMade'),
    freeThrowsAttempted: n(f, 'FreeThrowsAttempted'),
    offensiveRebounds: n(f, 'OffensiveRebounds'),
    defensiveRebounds: n(f, 'DefensiveRebounds'),
    totalRebounds: n(f, 'TotalRebounds'),
    assists: n(f, 'Assistances'),
    steals: n(f, 'Steals'),
    turnovers: n(f, 'Turnovers'),
    blocks: n(f, 'BlocksFavour'),
    blocksAgainst: n(f, 'BlocksAgainst'),
    rating: n(f, 'Valuation'),
  };
}

function toSide(club: string): BoxScoreSide {
  // Ogni lato ha anche una riga "Team" (codice 0) con le statistiche attribuite alla squadra, non a un giocatore.
  const players = textRecords(club, 'stat').filter((p) => p.PlayerCode.trim() !== '0');
  const total = textRecords(section(club, 'totals'), 'total')[0];
  return {
    players: players.map((p): BoxScorePlayer => ({
      id: personId(p.PlayerCode.trim()),
      ...splitName(p.PlayerName),
      number: p.Dorsal || '-',
      photoUrl: null,
      starter: p.StartFive === 'true',
      plusMinus: n(p, 'PlusMinus'),
      stats: toStats(p),
    })),
    totals: total ? toStats(total) : toStats({}),
  };
}
