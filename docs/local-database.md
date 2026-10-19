# Database locale e sincronizzazione

Le schermate leggono **solo** dal database SQLite (`expo-sqlite`, file `tuttobasket.db`). La rete è usata
esclusivamente da `SyncLeague` (`src/application/SyncLeague.ts`), che scarica ciò che il database non ha ancora.
Base URL API: `https://www.legabasket.it/api`.

## Schema

Definito in `src/infrastructure/db/schema.ts`, una migrazione per versione (`PRAGMA user_version`).

| Tabella | Contenuto | Chiave |
|---|---|---|
| `competitions` | Regular Season per stagione, con `total_days` | `id` |
| `teams` | Squadre; `roster_fetched_at` = ultimo download del roster | `id` |
| `coaches` | Allenatore di ogni squadra | `id` |
| `players` | Anagrafica; `has_bio` = 0 se creato dal box score, 1 se completo dal roster | `id` |
| `matches` | Calendario e risultati; `box_score_fetched_at`, `box_score_final` per la sincronizzazione | `id` |
| `calendar_days` | Giornate scaricate e quando (`fetched_at`) | `(competition_id, day_number)` |
| `player_games` | Statistiche di ogni giocatore a referto in ogni partita (anche chi non gioca: `minutes = 0`) | `(match_id, player_id)` |
| `team_game_stats` | Totali ufficiali di squadra per partita (con rimbalzi e palle perse di squadra) | `(match_id, team_id)` |

Viste (solo partite `finished`, così i box score parziali delle partite live non entrano nei conteggi):

- `team_games`: una riga per squadra per partita, dal suo punto di vista (`is_home`, `team_score`, `opponent_score`, `won`).
- `player_season_totals`: somme per giocatore e competizione, solo partite giocate (`games`).
- `team_season_totals`: somme per squadra e competizione.

Esempio di query complessa: top 10 marcatori per media punti, con almeno 3 partite.

```sql
SELECT p.last_name, t.games, 1.0 * t.points / t.games AS ppg
FROM player_season_totals t JOIN players p ON p.id = t.player_id
WHERE t.games >= 3 ORDER BY ppg DESC LIMIT 10;
```

## Cosa viene scaricato, e quando

| Endpoint | Quando | Mai più dopo |
|---|---|---|
| `get-championships?s=` | Solo se la stagione non è nel database | Una volta |
| `get-championships-calendar-by-id?id=&d=` | Giornata mai scaricata, oppure non conclusa e scaduta (vedi sotto) | Quando tutte le sue partite sono `finished` |
| `get-championships-matches-scores-by-id?id=` | Partita conclusa senza box score, o con box score non definitivo | Box score scaricato a partita conclusa da oltre 3 ore dalla palla a due con almeno un giocatore |
| `get-team-roster?id=` | Squadra senza roster, o con un giocatore sconosciuto sceso in campo dopo l'ultimo download | Finché non compaiono giocatori nuovi |

Validità di una giornata non conclusa (`dayTtl`): 15 s se ha una partita live; altrimenti il tempo alla prima palla a due,
tra 15 s e 30 min; 12 ore se manca più di una settimana; 1 ora se è vuota.

Non vengono più chiamati: classifica, statistiche squadra, statistiche giocatore, game log. Sono calcolati dal database.

## Come si calcolano i dati derivati

- **Classifica** (`domain/standings.ts`): vittorie, punti (2 a vittoria) e canestri dalle partite concluse. Ordine: punti,
  poi scontri diretti tra pari merito, differenza canestri, punti fatti. Playoff = prime 8, retrocessione = ultime 2.
  Limiti: le penalizzazioni di punti non sono ricavabili dai risultati; con tre o più squadre a pari merito l'ordine può
  differire da quello della Lega.
- **Medie, massimi e totali giocatore**: dalle righe di `player_games` con `minutes > 0` (`domain/statLines.ts`).
- **Posizione del giocatore nella lega** (`rankInLeague`): per ogni media mostrata nel profilo, `1 + giocatori strettamente
  migliori` tra tutti quelli di `player_season_totals` della stagione. Palle perse: meglio meno. Le percentuali di tiro
  contano solo con almeno un tiro a partita (altrimenti un 1/1 batterebbe tutti): sotto soglia non si mostra la posizione.
  Partite e massimi stagione non hanno posizione.
- **Classifica completa** (`app/ranking/[stat].tsx`): toccando una media nel profilo si apre l'elenco di tutti i giocatori
  classificati per quella statistica (`sortByStat`, stessa regola e stessi pari merito), centrato sul giocatore di partenza.
- **Medie squadra e posizioni**: da `team_season_totals`; la posizione è `1 + numero di squadre con media migliore`.

## Avanzamento

`SyncLeague` espone uno stato (`useSyncState`): la barra in fondo allo schermo mostra fase e avanzamento
(`Calendario`, `Statistiche delle partite`, `Roster`). Al primissimo avvio, finché il calendario non è completo,
una schermata dedicata prende il posto dell'app. `useDataVersion` cambia (al più una volta al secondo) quando arrivano
dati nuovi: le schermate lo usano come dipendenza di `useAsync` e si rileggono dal database.

Ogni elemento è salvato appena arriva: una sincronizzazione interrotta riparte da dove era. Un elemento che fallisce
non ferma gli altri e viene ritentato alla sincronizzazione successiva.

## Partite live

La schermata partita chiama `refreshMatch(id, true)` ogni 30 s mentre la partita è live (e nell'ultima mezz'ora prima):
riscarica la giornata e il box score. I box score live sono salvati ma non contano nelle statistiche finché la partita
non è `finished`.
