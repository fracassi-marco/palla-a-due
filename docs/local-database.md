# Database locale e sincronizzazione

Le schermate leggono **solo** dal database SQLite (`expo-sqlite`). La rete è usata
esclusivamente da `SyncLeague` (`src/application/SyncLeague.ts`), che scarica ciò che il database non ha ancora.

Ogni campionato ha il suo database e la sua `SyncLeague` (`di/container.ts`, creati alla prima selezione):
`pallaadue.db` (LBA, base URL API `https://www.legabasket.it/api`), `pallaadue-a2.db` e `pallaadue-b.db`
(LNP: vedi `docs/api-lnp.md`). Gli id di LBA e LNP, e quelli di stagioni diverse, non si mescolano mai. La tabella
sotto descrive le chiamate della LBA; LNP segue le stesse regole di validità con le sue sorgenti.

## Schema

Definito in `src/infrastructure/db/schema.ts`, una migrazione per versione (`PRAGMA user_version`).

| Tabella | Contenuto | Chiave |
|---|---|---|
| `competitions` | Regular Season per stagione, con `total_days`; una per girone in Serie B | `id` |
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

## Copertura e cache per campionato

Per ogni campionato, quali funzioni sono attive, quale chiamata le alimenta e quanto resta valido il dato.
✓ = attivo, ~ = parziale (stato e punteggio live dedotti, mai osservati con una partita in corso: vedi `docs/api-lnp.md`).
`dayTtl` è la validità di una giornata non conclusa (sezione sopra); "mai più" = il dato è definitivo e non si riscarica.
Calendario e statistiche riguardano la sola Regular Season (per EuroLeague ed EuroCup, la fase a gironi).

| Campionato | Statistiche | Calendario | Punteggi live | Tabellini live |
|---|---|---|---|---|
| **LBA** | ✓ `get-championships-matches-scores-by-id?id=` (box score) e `get-team-roster?id=` (roster); medie e classifiche calcolate dal database.<br>**Cache:** box score mai più dopo 3 h dalla palla a due con almeno un giocatore; roster finché non compaiono giocatori nuovi | ✓ `get-championships-calendar-by-id?id=&d=`.<br>**Cache:** mai più a giornata conclusa; altrimenti `dayTtl` (15 s live, 15 s–30 min vicino alla palla a due, 12 h oltre una settimana, 1 h se vuota) | ✓ `get-championships-calendar-by-id?id=&d=` (punteggio nella giornata).<br>**Cache:** 15 s; la home e il calendario rileggono ogni 30 s mentre c'è una partita live | ✓ `get-championships-matches-scores-by-id?id=`.<br>**Cache:** nessuna, a ogni refresh (30 s); non salvato nel database |
| **Serie A2** | ✓ `GET /wp/match/<gameid>/ita2/x2627` (box score HTML) e scheda squadra HTML (roster).<br>**Cache:** box score mai più dopo 3 h dalla palla a due con almeno un giocatore; roster finché non compaiono giocatori nuovi | ✓ `lnpstat.domino.it/getstatisticsfiles?task=schedule&year=x2627&league=ita2&round=<n>`.<br>**Cache:** come LBA (`dayTtl`) | ~ stesso endpoint del calendario (`game_status` diverso da `finished`/`ready` = live).<br>**Cache:** 15 s | ~ `GET /wp/match/<gameid>/ita2/x2627` (pagina HTML, non verificata durante una partita).<br>**Cache:** nessuna; non salvato nel database |
| **Serie B Nazionale** | ✓ come Serie A2, con `league=ita3_a` / `ita3_b` (un girone per competizione).<br>**Cache:** come Serie A2 | ✓ come Serie A2, con `league=ita3_a` / `ita3_b`.<br>**Cache:** come LBA (`dayTtl`) | ~ come Serie A2.<br>**Cache:** 15 s | ~ come Serie A2.<br>**Cache:** nessuna; non salvato nel database |
| **EuroLeague** | ✓ `api-live.euroleague.net/v2/competitions/E/seasons/E2026/games/<gameCode>/stats` e `…/clubs/<codice>/people` (roster).<br>**Cache:** box score mai più dopo 3 h dalla palla a due con almeno un giocatore; roster finché non compaiono giocatori nuovi | ✓ `…/E/seasons/E2026/games?limit=500` (tutta la stagione in una risposta).<br>**Cache:** in memoria 10 s, condivisa tra giornate; nel database `dayTtl` | ✓ `live.euroleague.net/api/Header?gamecode=<n>&seasoncode=E2026` (`ScoreA`/`ScoreB`); se non risponde restano i dati v2 (0-0).<br>**Cache:** 15 s | ✓ `…/games/<gameCode>/stats`, e se vuoto `live.euroleague.net/api/Boxscore?gamecode=<n>&seasoncode=E2026`.<br>**Cache:** nessuna, a ogni refresh (30 s); non salvato nel database |
| **EuroCup** | ✓ come EuroLeague, con coppa `U` (`…/U/seasons/U2026/…`).<br>**Cache:** come EuroLeague | ✓ come EuroLeague, con coppa `U`; un girone per competizione.<br>**Cache:** come EuroLeague | ✓ come EuroLeague, con `seasoncode=U2026` (verificato il 21/10/2026).<br>**Cache:** 15 s | ✓ come EuroLeague, con `seasoncode=U2026`.<br>**Cache:** nessuna; non salvato nel database |
| **NBA** | ✓ `cdn.nba.com/static/json/liveData/boxscore/boxscore_<gameId>.json` (box score) e `staticData/playerIndex.json` (roster, senza allenatore).<br>**Cache:** box score mai più dopo 3 h dalla palla a due con almeno un giocatore; roster finché non compaiono giocatori nuovi; anagrafica in memoria 1 h | ✓ `staticData/scheduleLeagueV2.json` (tutta la stagione, 7 MB); giornata = settimana.<br>**Cache:** in memoria 2 min, condivisa tra giornate; nel database `dayTtl` | ~ `liveData/scoreboard/todaysScoreboard_00.json` sopra il calendario (non verificato con una partita in corso: il 22/10/2026 erano tutte concluse).<br>**Cache:** 10 s in memoria; 15 s nel database | ~ stesso `boxscore_<gameId>.json`, aggiornato in diretta (formato verificato solo su partite concluse).<br>**Cache:** nessuna, a ogni refresh (30 s); non salvato nel database |

**Backup.** Se la chiamata indicata si guasta si passa a una fonte di riserva (`docs/api-backup.md`): per EuroLeague ed EuroCup
l'API v1 di Euroleague (tutte e quattro le funzioni), per LBA e Serie A2 TheSportsDB (solo stato e punteggio delle partite già nel
database: ✓ in *Calendario* e *Punteggi live*, nessuna copertura per box score e roster), per la NBA il tabellone di ESPN (calendario, stato
e punteggi, anche partite nuove; niente box score e roster). La Serie B Nazionale non ha backup.
Roster e box score di un backup non cancellano foto, altezza, peso e data di nascita già salvati.

## Cosa viene scaricato, e quando

| Endpoint | Quando | Mai più dopo |
|---|---|---|
| `get-championships?s=` | Solo se la stagione non è nel database | Una volta |
| `get-championships-calendar-by-id?id=&d=` | Giornata mai scaricata, oppure non conclusa e scaduta (vedi sotto) | Quando tutte le sue partite sono `finished` |
| `get-championships-matches-scores-by-id?id=` | Partita conclusa senza box score, o con box score non definitivo; per una partita live, a ogni refresh, senza salvarlo | Box score scaricato a partita conclusa da oltre 3 ore dalla palla a due con almeno un giocatore |
| `get-team-roster?id=` | Squadra senza roster, o con un giocatore sconosciuto sceso in campo dopo l'ultimo download | Finché non compaiono giocatori nuovi |

Validità di una giornata non conclusa (`dayTtl`): 15 s se ha una partita live; altrimenti il tempo alla prima palla a due,
tra 15 s e 30 min; 12 ore se manca più di una settimana; 1 ora se è vuota.

Non vengono più chiamati: classifica, statistiche squadra, statistiche giocatore, game log. Sono calcolati dal database.

## Come si calcolano i dati derivati

- **Classifica** (`domain/standings.ts`): vittorie, punti (2 a vittoria) e canestri dalle partite concluse. Ordine: punti,
  poi scontri diretti tra pari merito, differenza canestri, punti fatti. Playoff = prime 8, retrocessione = ultime 2
  (solo LBA: per A2 e B le zone non sono evidenziate, vedi `LEAGUES` in `domain/League.ts`). Una classifica per competizione.
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
dati nuovi: le schermate lo usano come dipendenza di `useAsync` e si rileggono dal database. `statsVersion` aumenta solo
quando si salva un box score o un roster: lo usano classifica statistica e profilo giocatore, che sono le letture più pesanti.

Ogni elemento è salvato appena arriva: una sincronizzazione interrotta riparte da dove era. Un elemento che fallisce
non ferma gli altri e viene ritentato alla sincronizzazione successiva.

## Partite live

La schermata partita chiama `refreshMatch(id, true)` ogni 30 s mentre la partita è live (e nell'ultima mezz'ora prima):
riscarica la giornata e il box score. Il box score live **non viene salvato**: `refreshMatch` lo restituisce e la schermata
lo tiene in memoria, così le statistiche di giocatori e squadre cambiano solo a partita conclusa. Quando la partita
diventa `finished` il box score viene scaricato e salvato come per le altre partite concluse.
