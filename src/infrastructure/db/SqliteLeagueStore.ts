import { BoxScoreSide, Competition, GameStats, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { DaySyncState, LeagueStore, MatchSyncInfo, StoredCompetition } from '../../domain/ports';
import { Database, SqlExecutor, SqlValue } from './Database';
import { COMPETITION_TEAM_IDS } from './rows';
import { GAME_STATS_FIELDS } from './schema';

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
/** Un box score non definitivo viene riscaricato al più ogni 30 minuti... */
const RETRY_AFTER_MS = 30 * MINUTE;
/** ...e solo per le partite delle ultime due settimane. */
const RETRY_WINDOW_MS = 14 * DAY;

interface MatchSyncRow {
  id: number;
  competition_id: number;
  day_number: number;
  status: MatchSyncInfo['status'];
  starts_at: number;
  box_score_final: number;
}

const toSyncInfo = (row: MatchSyncRow): MatchSyncInfo => ({
  id: row.id,
  competitionId: row.competition_id,
  dayNumber: row.day_number,
  status: row.status,
  startsAt: new Date(row.starts_at),
  boxScoreFinal: row.box_score_final === 1,
});

const MATCH_SYNC_SELECT = 'SELECT id, competition_id, day_number, status, starts_at, box_score_final FROM matches';

/** Valori di GAME_STATS_FIELDS, nello stesso ordine. */
function gameStatsValues(s: GameStats): SqlValue[] {
  return [
    s.minutes,
    s.points,
    s.fouls,
    s.foulsDrawn,
    s.twoMade,
    s.twoAttempted,
    s.threeMade,
    s.threeAttempted,
    s.freeThrowsMade,
    s.freeThrowsAttempted,
    s.offensiveRebounds,
    s.defensiveRebounds,
    s.totalRebounds,
    s.assists,
    s.steals,
    s.turnovers,
    s.blocks,
    s.blocksAgainst,
    s.rating,
  ];
}

const STATS_COLUMNS = GAME_STATS_FIELDS.join(', ');
const STATS_PLACEHOLDERS = GAME_STATS_FIELDS.map(() => '?').join(', ');

async function upsertTeam(txn: SqlExecutor, team: { id: number; name: string; code: string; logoUrl: string | null }) {
  await txn.runAsync(
    `INSERT INTO teams (id, name, code, logo_url) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, code = excluded.code,
       logo_url = COALESCE(excluded.logo_url, logo_url)`,
    [team.id, team.name, team.code, team.logoUrl],
  );
}

export class SqliteLeagueStore implements LeagueStore {
  constructor(private readonly db: Database) {}

  async getCompetitions(seasonYear: number): Promise<StoredCompetition[]> {
    const rows = await this.db.getAllAsync<{ id: number; name: string; season_year: number; total_days: number | null }>(
      'SELECT id, name, season_year, total_days FROM competitions WHERE season_year = ? ORDER BY id',
      [seasonYear],
    );
    return rows.map((row) => ({ id: row.id, name: row.name, year: row.season_year, totalDays: row.total_days }));
  }

  async saveCompetition(competition: Competition, totalDays: number | null): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO competitions (id, season_year, name, total_days) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET season_year = excluded.season_year, name = excluded.name,
         total_days = COALESCE(excluded.total_days, total_days)`,
      [competition.id, competition.year, competition.name, totalDays],
    );
  }

  async getDaySyncStates(competitionId: number): Promise<DaySyncState[]> {
    const rows = await this.db.getAllAsync<{
      day_number: number;
      fetched_at: number;
      total: number;
      finished: number | null;
      live: number | null;
      next_kickoff: number | null;
    }>(
      `SELECT d.day_number, d.fetched_at, COUNT(m.id) AS total,
              SUM(m.status = 'finished') AS finished, SUM(m.status = 'live') AS live,
              MIN(CASE WHEN m.status != 'finished' THEN m.starts_at END) AS next_kickoff
       FROM calendar_days d
       LEFT JOIN matches m ON m.competition_id = d.competition_id AND m.day_number = d.day_number
       WHERE d.competition_id = ?
       GROUP BY d.day_number, d.fetched_at`,
      [competitionId],
    );
    return rows.map((r) => ({
      dayNumber: r.day_number,
      fetchedAt: r.fetched_at,
      complete: r.total > 0 && r.finished === r.total,
      hasLive: (r.live ?? 0) > 0,
      nextKickoff: r.next_kickoff,
    }));
  }

  async saveDay(competitionId: number, dayNumber: number, matches: Match[], fetchedAt: number): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const m of matches) {
        await upsertTeam(txn, m.home);
        await upsertTeam(txn, m.away);
        await txn.runAsync(
          `INSERT INTO matches (id, competition_id, day_number, day_name, starts_at, status, home_team_id, away_team_id,
                                home_score, away_score, venue, city, has_streaming, live_label)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET competition_id = excluded.competition_id, day_number = excluded.day_number,
             day_name = excluded.day_name, starts_at = excluded.starts_at, status = excluded.status,
             home_team_id = excluded.home_team_id, away_team_id = excluded.away_team_id,
             home_score = excluded.home_score, away_score = excluded.away_score,
             venue = excluded.venue, city = excluded.city, has_streaming = excluded.has_streaming,
             live_label = excluded.live_label`,
          [
            m.id,
            competitionId,
            m.dayNumber,
            m.dayName,
            m.startsAt.getTime(),
            m.status,
            m.home.id,
            m.away.id,
            m.homeScore,
            m.awayScore,
            m.venue,
            m.city,
            m.hasStreaming ? 1 : 0,
            m.liveLabel,
          ],
        );
      }
      await txn.runAsync(
        `INSERT INTO calendar_days (competition_id, day_number, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT (competition_id, day_number) DO UPDATE SET fetched_at = excluded.fetched_at`,
        [competitionId, dayNumber, fetchedAt],
      );
    });
  }

  async getMatchSyncInfo(matchId: number): Promise<MatchSyncInfo | null> {
    const row = await this.db.getFirstAsync<MatchSyncRow>(`${MATCH_SYNC_SELECT} WHERE id = ?`, [matchId]);
    return row ? toSyncInfo(row) : null;
  }

  async getPendingBoxScores(competitionId: number, now: number): Promise<MatchSyncInfo[]> {
    const rows = await this.db.getAllAsync<MatchSyncRow>(
      `${MATCH_SYNC_SELECT}
       WHERE competition_id = ? AND status = 'finished' AND (
         box_score_fetched_at IS NULL
         OR (box_score_final = 0 AND box_score_fetched_at < ? AND starts_at > ?))
       ORDER BY starts_at DESC`,
      [competitionId, now - RETRY_AFTER_MS, now - RETRY_WINDOW_MS],
    );
    return rows.map(toSyncInfo);
  }

  async saveBoxScore(matchId: number, boxScore: MatchBoxScore, final: boolean, fetchedAt: number): Promise<void> {
    const match = await this.db.getFirstAsync<{ home_team_id: number; away_team_id: number; starts_at: number }>(
      'SELECT home_team_id, away_team_id, starts_at FROM matches WHERE id = ?',
      [matchId],
    );
    if (!match) throw new Error(`Partita ${matchId} sconosciuta`);

    const sides: [number, BoxScoreSide][] = [
      [match.home_team_id, boxScore.home],
      [match.away_team_id, boxScore.away],
    ];

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM player_games WHERE match_id = ?', [matchId]);
      await txn.runAsync('DELETE FROM team_game_stats WHERE match_id = ?', [matchId]);

      for (const [teamId, side] of sides) {
        for (const p of side.players) {
          // Il giocatore è nuovo: nome, numero e foto bastano finché il roster non ne completa l'anagrafica.
          // Se esiste già, lo spostiamo di squadra solo se questa è la sua partita più recente (trasferimenti).
          await txn.runAsync(
            `INSERT INTO players (id, team_id, first_name, last_name, number, photo_url) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET team_id = excluded.team_id
             WHERE players.team_id IS NOT excluded.team_id AND NOT EXISTS (
               SELECT 1 FROM player_games g JOIN matches gm ON gm.id = g.match_id
               WHERE g.player_id = players.id AND gm.starts_at > ?)`,
            [p.id, teamId, p.firstName, p.lastName, p.number, p.photoUrl, match.starts_at],
          );
          await txn.runAsync(
            `INSERT INTO player_games (match_id, player_id, team_id, starter, plus_minus, ${STATS_COLUMNS})
             VALUES (?, ?, ?, ?, ?, ${STATS_PLACEHOLDERS})`,
            [matchId, p.id, teamId, p.starter ? 1 : 0, p.plusMinus, ...gameStatsValues(p.stats)],
          );
        }
        await txn.runAsync(
          `INSERT INTO team_game_stats (match_id, team_id, ${STATS_COLUMNS}) VALUES (?, ?, ${STATS_PLACEHOLDERS})`,
          [matchId, teamId, ...gameStatsValues(side.totals)],
        );
      }

      await txn.runAsync('UPDATE matches SET box_score_fetched_at = ?, box_score_final = ? WHERE id = ?', [
        fetchedAt,
        final ? 1 : 0,
        matchId,
      ]);
    });
  }

  async getTeamsNeedingRoster(competitionId: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ id: number }>(
      `SELECT t.id FROM teams t
       WHERE t.id IN (${COMPETITION_TEAM_IDS}) AND (
         t.roster_fetched_at IS NULL
         OR EXISTS (
           SELECT 1 FROM player_games pg
           JOIN players p ON p.id = pg.player_id
           JOIN matches m ON m.id = pg.match_id
           WHERE pg.team_id = t.id AND p.has_bio = 0 AND m.starts_at > t.roster_fetched_at))
       ORDER BY t.id`,
      [competitionId, competitionId],
    );
    return rows.map((r) => r.id);
  }

  async saveRoster(roster: Roster, fetchedAt: number): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await upsertTeam(txn, roster.team);
      // Chi non è più nel roster resta nel database (le sue partite restano) ma senza squadra.
      await txn.runAsync('UPDATE players SET team_id = NULL WHERE team_id = ?', [roster.team.id]);
      await txn.runAsync('DELETE FROM coaches WHERE team_id = ?', [roster.team.id]);
      if (roster.coach) {
        await txn.runAsync(
          `INSERT INTO coaches (id, team_id, first_name, last_name, photo_url) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET team_id = excluded.team_id, first_name = excluded.first_name,
             last_name = excluded.last_name, photo_url = excluded.photo_url`,
          [roster.coach.id, roster.team.id, roster.coach.firstName, roster.coach.lastName, roster.coach.photoUrl],
        );
      }
      for (const p of roster.players) {
        await txn.runAsync(
          `INSERT INTO players (id, team_id, first_name, last_name, number, photo_url, role, country,
                                birth_date, birth_place, height_cm, weight_kg, has_bio)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT (id) DO UPDATE SET team_id = excluded.team_id, first_name = excluded.first_name,
             last_name = excluded.last_name, number = excluded.number,
             photo_url = COALESCE(excluded.photo_url, photo_url),
             role = excluded.role, country = excluded.country,
             birth_date = COALESCE(excluded.birth_date, birth_date),
             birth_place = excluded.birth_place,
             height_cm = COALESCE(excluded.height_cm, height_cm),
             weight_kg = COALESCE(excluded.weight_kg, weight_kg), has_bio = 1`,
          [
            p.id,
            roster.team.id,
            p.firstName,
            p.lastName,
            p.number,
            p.photoUrl,
            p.role,
            p.country,
            p.birthDate,
            p.birthPlace,
            p.heightCm,
            p.weightKg,
          ],
        );
      }
      await txn.runAsync('UPDATE teams SET roster_fetched_at = ? WHERE id = ?', [fetchedAt, roster.team.id]);
    });
  }
}
