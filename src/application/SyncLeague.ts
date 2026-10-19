import { toBoxScore } from '../domain/boxScore';
import { BoxScore, Match, MatchBoxScore } from '../domain/entities';
import { DaySyncState, LeagueSource, LeagueStore, MatchSyncInfo } from '../domain/ports';
import { PoolResult, runPool, withRetry } from './pool';
import { currentSeasonYear } from './season';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Chiamate di rete in parallelo durante la sincronizzazione. */
const CONCURRENCY = 4;
/** Una partita conclusa da meno di questo tempo (dalla palla a due) può ancora ricevere correzioni. */
const SETTLE_MARGIN_MS = 3 * HOUR;
/** Tra una sincronizzazione completa e la successiva (al ritorno in primo piano) deve passare almeno questo tempo. */
const MIN_RESYNC_INTERVAL_MS = 5 * MINUTE;
/** Le schermate vengono avvisate di nuovi dati al più una volta al secondo durante lo scaricamento. */
const NOTIFY_INTERVAL_MS = SECOND;

export type SyncPhase = 'calendar' | 'boxScores' | 'rosters';

export interface SyncState {
  status: 'idle' | 'running' | 'done' | 'error';
  phase: SyncPhase | null;
  /** Avanzamento della fase corrente. */
  done: number;
  total: number;
  /** I dati di base (calendario completo) sono nel database: null finché non lo sappiamo. */
  ready: boolean | null;
  /** Aumenta quando il database riceve dati nuovi: le schermate lo usano per rileggere. */
  dataVersion: number;
  /** Aumenta solo quando cambiano statistiche o anagrafica dei giocatori (box score e roster salvati): per le schermate che le mostrano. */
  statsVersion: number;
  error: string | null;
}

/** Quanto resta valida una giornata non ancora conclusa, in base a cosa può cambiare. */
function dayTtl(day: DaySyncState, now: number): number {
  if (day.hasLive) return 15 * SECOND;
  if (day.nextKickoff === null) return HOUR;
  const untilKickoff = day.nextKickoff - now;
  if (untilKickoff > 7 * DAY) return 12 * HOUR;
  return Math.min(Math.max(untilKickoff, 15 * SECOND), 30 * MINUTE);
}

/** Una giornata conclusa non si riscarica mai; le altre solo quando il dato salvato è scaduto. */
function dayIsStale(day: DaySyncState | undefined, now: number): boolean {
  if (!day) return true;
  if (day.complete) return false;
  return now - day.fetchedAt >= dayTtl(day, now);
}

const hasPlayers = (box: MatchBoxScore) => box.home.players.length + box.away.players.length > 0;

/**
 * Tiene il database locale allineato con la Lega scaricando solo ciò che manca:
 * giornate non ancora concluse (se scadute), box score di partite concluse, roster mai visti.
 * Ogni elemento è salvato appena arriva, quindi una sincronizzazione interrotta riparte da dove era.
 */
export class SyncLeague {
  private state: SyncState = {
    status: 'idle',
    phase: null,
    done: 0,
    total: 0,
    ready: null,
    dataVersion: 0,
    statsVersion: 0,
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private lastFinishedAt = 0;
  private lastNotifiedAt = 0;
  /** Un box score o un roster è stato salvato dall'ultima notifica: la prossima alzerà anche `statsVersion`. */
  private statsDirty = false;

  constructor(
    private readonly source: LeagueSource,
    private readonly store: LeagueStore,
  ) {}

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Avvia la sincronizzazione; se ne è già in corso una, ne attende la fine. */
  start(options: { minIntervalMs?: number } = {}): Promise<void> {
    if (this.running) return this.running;
    if (Date.now() - this.lastFinishedAt < (options.minIntervalMs ?? 0)) return Promise.resolve();
    this.running = this.execute().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Come `start`, per quando l'app torna in primo piano. */
  resume(): Promise<void> {
    return this.start({ minIntervalMs: MIN_RESYNC_INTERVAL_MS });
  }

  /**
   * Aggiorna una partita: giornata (se serve) e box score (se non è già definitivo).
   * Con `force` la giornata viene riscaricata anche se ancora valida: serve al polling live.
   * Il box score di una partita live non viene salvato (le statistiche contano solo a partita conclusa):
   * è restituito, perché la schermata lo mostri. Per le altre partite il risultato è null.
   */
  async refreshMatch(matchId: number, force = false): Promise<BoxScore | null> {
    let info = await this.store.getMatchSyncInfo(matchId);
    if (!info) return null;

    if (info.status !== 'finished') {
      const days = await this.store.getDaySyncStates(info.competitionId);
      if (force || dayIsStale(days.find((d) => d.dayNumber === info!.dayNumber), Date.now())) {
        await this.fetchDay(info.competitionId, info.dayNumber);
        info = await this.store.getMatchSyncInfo(matchId);
        if (!info) return null;
      }
    }

    let live: BoxScore | null = null;
    if (info.status === 'live') {
      live = toBoxScore(await withRetry(() => this.source.getBoxScore(info!.id)));
    } else if (info.status === 'finished' && !info.boxScoreFinal) {
      await this.fetchBoxScore(info);
    }
    this.notify(true);
    return live;
  }

  private async execute(): Promise<void> {
    this.update({ status: 'running', phase: 'calendar', done: 0, total: 0, error: null });
    const errors: PoolResult = { failures: 0, firstError: null };
    const track = (result: PoolResult) => {
      errors.failures += result.failures;
      errors.firstError ??= result.firstError;
    };

    try {
      const competition = await this.ensureCompetition();
      this.update({ ready: await this.hasFullCalendar(competition.id, competition.totalDays) });

      track(await this.syncCalendar(competition.id, competition.totalDays));
      const ready = await this.hasFullCalendar(competition.id, competition.totalDays);
      this.update({ ready });
      this.notify(true);

      if (ready) {
        track(await this.syncBoxScores(competition.id));
        track(await this.syncRosters(competition.id));
      }

      this.lastFinishedAt = Date.now();
      if (errors.failures > 0) {
        const cause = errors.firstError ? `: ${errors.firstError.message}` : '';
        this.update({ status: 'error', phase: null, error: `${errors.failures} richieste non riuscite${cause}` });
      } else {
        this.update({ status: 'done', phase: null });
      }
    } catch (error) {
      this.update({ status: 'error', phase: null, error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.notify(true);
    }
  }

  /** Competizione della stagione corrente, con il numero di giornate (dedotto dalla prima giornata). */
  private async ensureCompetition(): Promise<{ id: number; totalDays: number }> {
    const season = currentSeasonYear();
    let competition = await this.store.getCompetition(season);
    if (!competition) {
      const found = await withRetry(() => this.source.findRegularSeason(season));
      await this.store.saveCompetition(found, null);
      competition = { ...found, totalDays: null };
    }
    if (competition.totalDays !== null) return { id: competition.id, totalDays: competition.totalDays };

    const firstDay = await this.fetchDay(competition.id, 1);
    // Girone all'italiana andata/ritorno: 2 * (squadre - 1) giornate, con 2 squadre per partita.
    const totalDays = firstDay.length > 0 ? 4 * firstDay.length - 2 : 30;
    await this.store.saveCompetition(competition, totalDays);
    return { id: competition.id, totalDays };
  }

  private async hasFullCalendar(competitionId: number, totalDays: number): Promise<boolean> {
    const days = await this.store.getDaySyncStates(competitionId);
    return days.length >= totalDays;
  }

  private async syncCalendar(competitionId: number, totalDays: number) {
    const states = new Map((await this.store.getDaySyncStates(competitionId)).map((d) => [d.dayNumber, d]));
    const now = Date.now();
    const stale = Array.from({ length: totalDays }, (_, i) => i + 1).filter((day) => dayIsStale(states.get(day), now));

    this.update({ phase: 'calendar', done: 0, total: stale.length });
    return runPool(stale, CONCURRENCY, async (day) => {
      await this.fetchDay(competitionId, day);
      this.progress();
    });
  }

  private async syncBoxScores(competitionId: number) {
    const pending = await this.store.getPendingBoxScores(competitionId, Date.now());
    this.update({ phase: 'boxScores', done: 0, total: pending.length });
    return runPool(pending, CONCURRENCY, async (info) => {
      await this.fetchBoxScore(info);
      this.progress();
    });
  }

  private async syncRosters(competitionId: number) {
    const teamIds = await this.store.getTeamsNeedingRoster(competitionId);
    this.update({ phase: 'rosters', done: 0, total: teamIds.length });
    return runPool(teamIds, CONCURRENCY, async (teamId) => {
      const roster = await withRetry(() => this.source.getRoster(teamId));
      await this.store.saveRoster(roster, Date.now());
      this.statsDirty = true;
      this.progress();
    });
  }

  private async fetchDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const matches = await withRetry(() => this.source.getDay(competitionId, dayNumber));
    await this.store.saveDay(competitionId, dayNumber, matches, Date.now());
    return matches;
  }

  private async fetchBoxScore(info: MatchSyncInfo): Promise<void> {
    const box = await withRetry(() => this.source.getBoxScore(info.id));
    const now = Date.now();
    const final = info.status === 'finished' && hasPlayers(box) && now > info.startsAt.getTime() + SETTLE_MARGIN_MS;
    await this.store.saveBoxScore(info.id, box, final, now);
    this.statsDirty = true;
  }

  private progress() {
    this.update({ done: this.state.done + 1 });
    this.notify();
  }

  private update(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Segnala alle schermate che il database è cambiato; durante lo scaricamento al più una volta al secondo. */
  private notify(force = false) {
    const now = Date.now();
    if (!force && now - this.lastNotifiedAt < NOTIFY_INTERVAL_MS) return;
    this.lastNotifiedAt = now;
    const statsVersion = this.state.statsVersion + (this.statsDirty ? 1 : 0);
    this.statsDirty = false;
    this.update({ dataVersion: this.state.dataVersion + 1, statsVersion });
  }
}
