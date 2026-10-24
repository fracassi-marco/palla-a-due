/**
 * Schema del database locale. Ogni voce è una migrazione: la posizione nell'array è la versione
 * (`PRAGMA user_version`). Non modificare una migrazione già rilasciata: aggiungine una nuova.
 */

/** Colonne delle statistiche di una partita, uguali per i giocatori e per i totali di squadra. */
const GAME_STATS_COLUMNS = `
  minutes             INTEGER NOT NULL DEFAULT 0,
  points              INTEGER NOT NULL DEFAULT 0,
  fouls               INTEGER NOT NULL DEFAULT 0,
  fouls_drawn         INTEGER NOT NULL DEFAULT 0,
  two_made            INTEGER NOT NULL DEFAULT 0,
  two_attempted       INTEGER NOT NULL DEFAULT 0,
  three_made          INTEGER NOT NULL DEFAULT 0,
  three_attempted     INTEGER NOT NULL DEFAULT 0,
  free_throws_made    INTEGER NOT NULL DEFAULT 0,
  free_throws_attempted INTEGER NOT NULL DEFAULT 0,
  offensive_rebounds  INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds  INTEGER NOT NULL DEFAULT 0,
  total_rebounds      INTEGER NOT NULL DEFAULT 0,
  assists             INTEGER NOT NULL DEFAULT 0,
  steals              INTEGER NOT NULL DEFAULT 0,
  turnovers           INTEGER NOT NULL DEFAULT 0,
  blocks              INTEGER NOT NULL DEFAULT 0,
  blocks_against      INTEGER NOT NULL DEFAULT 0,
  rating              INTEGER NOT NULL DEFAULT 0`;

/** Nomi delle colonne di GAME_STATS_COLUMNS, nello stesso ordine, per costruire INSERT e SELECT. */
export const GAME_STATS_FIELDS = [
  'minutes',
  'points',
  'fouls',
  'fouls_drawn',
  'two_made',
  'two_attempted',
  'three_made',
  'three_attempted',
  'free_throws_made',
  'free_throws_attempted',
  'offensive_rebounds',
  'defensive_rebounds',
  'total_rebounds',
  'assists',
  'steals',
  'turnovers',
  'blocks',
  'blocks_against',
  'rating',
] as const;

/** Somme delle statistiche, per le viste che aggregano una stagione. */
const sums = (alias: string) => GAME_STATS_FIELDS.map((f) => `SUM(${alias}.${f}) AS ${f}`).join(',\n  ');

const MIGRATION_1 = `
CREATE TABLE competitions (
  id          INTEGER PRIMARY KEY,
  season_year INTEGER NOT NULL,
  name        TEXT NOT NULL,
  total_days  INTEGER
);
CREATE INDEX idx_competitions_season ON competitions (season_year);

CREATE TABLE teams (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  logo_url          TEXT,
  roster_fetched_at INTEGER
);

CREATE TABLE coaches (
  id         INTEGER PRIMARY KEY,
  team_id    INTEGER NOT NULL REFERENCES teams (id),
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  photo_url  TEXT
);
CREATE INDEX idx_coaches_team ON coaches (team_id);

CREATE TABLE players (
  id          INTEGER PRIMARY KEY,
  team_id     INTEGER REFERENCES teams (id),
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  number      TEXT NOT NULL DEFAULT '-',
  photo_url   TEXT,
  role        TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  birth_date  TEXT,
  birth_place TEXT,
  height_cm   INTEGER,
  weight_kg   INTEGER,
  -- 0 = creato dal box score (nome, numero, foto); 1 = anagrafica completa dal roster
  has_bio     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_players_team ON players (team_id);

CREATE TABLE matches (
  id                   INTEGER PRIMARY KEY,
  competition_id       INTEGER NOT NULL REFERENCES competitions (id),
  day_number           INTEGER NOT NULL,
  day_name             TEXT NOT NULL,
  starts_at            INTEGER NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'finished')),
  home_team_id         INTEGER NOT NULL REFERENCES teams (id),
  away_team_id         INTEGER NOT NULL REFERENCES teams (id),
  home_score           INTEGER,
  away_score           INTEGER,
  venue                TEXT,
  city                 TEXT,
  has_streaming        INTEGER NOT NULL DEFAULT 0,
  box_score_fetched_at INTEGER,
  -- 1 = box score scaricato a partita chiusa da abbastanza tempo: non si scarica più
  box_score_final      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_matches_day ON matches (competition_id, day_number);
CREATE INDEX idx_matches_home ON matches (home_team_id);
CREATE INDEX idx_matches_away ON matches (away_team_id);
CREATE INDEX idx_matches_starts_at ON matches (starts_at);

CREATE TABLE calendar_days (
  competition_id INTEGER NOT NULL REFERENCES competitions (id),
  day_number     INTEGER NOT NULL,
  fetched_at     INTEGER NOT NULL,
  PRIMARY KEY (competition_id, day_number)
) WITHOUT ROWID;

-- Una riga per ogni giocatore a referto (anche chi non è sceso in campo: minutes = 0).
CREATE TABLE player_games (
  match_id   INTEGER NOT NULL REFERENCES matches (id),
  player_id  INTEGER NOT NULL,
  team_id    INTEGER NOT NULL REFERENCES teams (id),
  starter    INTEGER NOT NULL DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,${GAME_STATS_COLUMNS},
  PRIMARY KEY (match_id, player_id)
) WITHOUT ROWID;
CREATE INDEX idx_player_games_player ON player_games (player_id);
CREATE INDEX idx_player_games_team ON player_games (team_id);

-- Totali ufficiali di squadra per partita (comprendono rimbalzi e palle perse di squadra).
CREATE TABLE team_game_stats (
  match_id INTEGER NOT NULL REFERENCES matches (id),
  team_id  INTEGER NOT NULL REFERENCES teams (id),${GAME_STATS_COLUMNS},
  PRIMARY KEY (match_id, team_id)
) WITHOUT ROWID;
CREATE INDEX idx_team_game_stats_team ON team_game_stats (team_id);

-- Le viste considerano solo partite concluse: i box score parziali delle partite live non entrano nei conteggi.

-- Una riga per squadra per partita conclusa, dal suo punto di vista.
CREATE VIEW team_games AS
SELECT m.id AS match_id, m.competition_id, m.day_number, m.starts_at,
       m.home_team_id AS team_id, m.away_team_id AS opponent_id, 1 AS is_home,
       m.home_score AS team_score, m.away_score AS opponent_score,
       CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS won
FROM matches m
WHERE m.status = 'finished' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
UNION ALL
SELECT m.id, m.competition_id, m.day_number, m.starts_at,
       m.away_team_id, m.home_team_id, 0,
       m.away_score, m.home_score,
       CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END
FROM matches m
WHERE m.status = 'finished' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL;

-- Totali stagionali per giocatore: solo le partite in cui è sceso in campo (games).
CREATE VIEW player_season_totals AS
SELECT m.competition_id, pg.player_id, COUNT(*) AS games,
  ${sums('pg')}
FROM player_games pg
JOIN matches m ON m.id = pg.match_id AND m.status = 'finished'
WHERE pg.minutes > 0
GROUP BY m.competition_id, pg.player_id;

-- Totali stagionali per squadra, dai totali ufficiali di partita.
CREATE VIEW team_season_totals AS
SELECT m.competition_id, ts.team_id, COUNT(*) AS games,
  ${sums('ts')}
FROM team_game_stats ts
JOIN matches m ON m.id = ts.match_id AND m.status = 'finished'
GROUP BY m.competition_id, ts.team_id;
`;

const MIGRATION_2 = `
ALTER TABLE matches ADD COLUMN live_label TEXT;
`;

export const MIGRATIONS: string[] = [MIGRATION_1, MIGRATION_2];
