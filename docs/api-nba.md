# Dati NBA

Fonte principale: i file JSON statici del CDN ufficiale della NBA, `https://cdn.nba.com/static/json/…`, senza chiave. Implementazione:
`src/infrastructure/nba/` (`NbaLeagueSource`). Backup: tabellone di ESPN (`NbaEspnLeagueSource`, vedi `docs/api-backup.md`).

| Dato | Endpoint | Note |
|---|---|---|
| Calendario e risultati | `staticData/scheduleLeagueV2.json` | Tutta la stagione (7 MB, 400 KB compressi): `gameId` (`002…` = Regular Season), `gameCode` (`20261020/BOSDET`: data a ora della costa Est, ospiti, casa), `gameStatus` 1/2/3, `gameDateTimeUTC`, arena e punteggi. Il file contiene un'unica stagione: `leagueSchedule.seasonYear` = `2026-27` |
| Partite in corso | `liveData/scoreboard/todaysScoreboard_00.json` | Solo il giorno corrente (35 KB), aggiornato durante la partita: serve per stato e punteggio live senza riscaricare il calendario |
| Box score | `liveData/boxscore/boxscore_<gameId>.json` | Disponibile da quando la partita inizia (prima il CDN risponde 403 XML di S3), aggiornato in diretta. Per giocatore: minuti (`PT33M15.00S`), tiri da 2 e da 3, liberi, rimbalzi, assist, recuperi, perse, stoppate fatte e subite, falli fatti e subiti, plus/minus, `starter`. Totali di squadra |
| Roster | `staticData/playerIndex.json` | Tutti i giocatori (280 KB): si filtra per `TEAM_ID`. Ruolo, numero, altezza (`6-8` piedi-pollici), peso (libbre), nazione. Niente data di nascita né allenatore |
| Foto e logo | `headshots/nba/latest/260x190/<personId>.png` (CDN NBA), `a.espncdn.com/i/teamlogos/nba/500/<sigla>.png` (ESPN) | Inclusi nell'app (WebP in `assets/images/{teams,players}/nba/`, generati da `scripts/download-images.mjs`: 30 logo e 519 foto dal `playerIndex`); i giocatori non nell'elenco (firmati dopo l'ultimo giro dello script) si caricano dall'URL remoto. Il logo ufficiale NBA è solo SVG con lo stesso nome per ogni squadra, quindi non entra nel manifest (chiave = ultimo segmento dell'URL) |

Il campionato ha un'unica competizione (`NBA`, id `anno * 10 + 1`) e **le giornate sono le settimane** (lunedì-domenica, 25 in
tutto; la prima parte dal lunedì prima dell'esordio): è la numerazione `weekNumber` della NBA, che l'app calcola da data e anno
(`weeks.ts`) perché ESPN non la ha. Verificato sulla stagione 2026/27: 1.200 partite su 1.200 coincidono. La fonte comunica all'app il
numero di giornate (`Competition.totalDays`), perché il girone all'italiana a cui pensano le altre leghe non vale qui.

## Accesso: intestazioni da browser

Il CDN è dietro Akamai e risponde `403 Access Denied` (HTML) ai client che non sembrano un browser. Verificato il 22/10/2026 con curl
e con `fetch` di Node: passa solo con un `User-Agent` di Chrome **e** `Accept-Language`, `Accept-Encoding`, `Referer`,
`sec-fetch-mode`, `sec-fetch-site`, `sec-ch-ua`; tolta una qualunque (o con `okhttp/…` come User-Agent) risponde 403. Le intestazioni
sono in `NBA_HEADERS` e `FetchHttpClient` le aggiunge a ogni richiesta. **Non è stato provato da un dispositivo**: React Native
(NSURLSession su iOS, OkHttp su Android) potrebbe ignorare o riscrivere qualche intestazione, e Akamai può cambiare le regole in
qualunque momento. In quel caso ogni richiesta fallisce con 403 e interviene il backup ESPN (calendario e punteggi, non box score e roster).
Gli stessi header servono per `cdn.wnba.com` (WNBA, vedi `docs/api-wnba.md`), che ha le stesse regole; le foto (`cdn.wnba.com/headshots/…`) invece non li richiedono.
Gli URL col dominio `stats.nba.com` (classifica, roster con allenatore, box score alternativo) non rispondono a curl (timeout) e non sono usati.

## Id numerici

Squadra = `teamId` ufficiale (`1610612765`); giocatore = `personId`. La partita non usa il `gameId` NBA, che ESPN non conosce:
id = `AAAAMMGG * 10000 + indice casa * 100 + indice ospiti` (indici 1-30 in `teams.ts`), quindi le due fonti danno lo stesso id alla
stessa partita e i loro dati si mescolano nel database senza duplicati. `getBoxScore` decodifica l'id e risale al `gameId` dal calendario.

## Decisioni e limiti noti

- Solo Regular Season: precampionato, play-in, playoff e le partite a eliminazione della NBA Cup (quarti, semifinali, finale: si
  riconoscono da `gameSubLabel`, hanno squadre da definire e non contano in classifica) sono scartati. Le partite del gruppo della NBA Cup contano.
- Classifica calcolata dalle partite e ordinata per **percentuale di vittorie** (`LeagueInfo.byWinPercentage`: le squadre non hanno
  giocato lo stesso numero di partite), poi divisa in **Conference Est e Ovest** (`LeagueInfo.conferences`, per sigla squadra). La
  divisione è un raggruppamento dentro l'unica competizione, non due competizioni: le partite tra le conference appartengono a entrambe.
  Posizioni e zone si assegnano a ciascuna conference (`splitByConference`): 1°-6° playoff (verde), 7°-10° play-in (arancione).
  Gli spareggi sono quelli semplificati di `domain/standings.ts` (non quelli ufficiali NBA); la posizione mostrata nella scheda squadra è quella
  nella classifica generale di 30 squadre, non nella conference.
- La valutazione (`rating`) è il PIR della EuroLeague, calcolato dal box score: la NBA non ne pubblica una.
- Minuti arrotondati per difetto a interi, come nelle altre fonti.
- Allenatore assente, data e luogo di nascita assenti. Giocatori `two-way` e quelli in `playerIndex` con `TEAM_ID` della squadra sono tutti nel roster.
- Il calendario si riscarica al più ogni 2 minuti; il tabellone (stato e punteggio live) ogni 10 secondi.
- Fuori stagione (da luglio alla pubblicazione del nuovo calendario) il file contiene ancora la stagione precedente: la fonte rifiuta
  (`Calendario NBA … non ancora pubblicato`) e risponde il backup, che propone le settimane previste senza partite.
