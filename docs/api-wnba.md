# Dati WNBA

Fonte principale: i file JSON statici del CDN ufficiale della WNBA, `https://cdn.wnba.com/static/json/…`, senza chiave: gli stessi file
e lo stesso formato della NBA (`docs/api-nba.md`), con il campionato numero 10. Implementazione: `src/infrastructure/wnba/`
(`WnbaLeagueSource`, che riusa DTO e mappers di `nba/`). Backup: tabellone di ESPN (`WnbaEspnLeagueSource`, vedi `docs/api-backup.md`).

| Dato | Endpoint | Note |
|---|---|---|
| Calendario e risultati | `staticData/scheduleLeagueV2.json` | Tutta la stagione (100 KB): `gameId` (`1022600101`: `102` = Regular Season), `gameCode` (`20260614/WASNYL`: data a ora della costa Est, ospiti, casa), `gameStatus` 1/2/3, `gameDateTimeUTC`, arena e punteggi. Contiene un'unica stagione: `leagueSchedule.seasonYear` = `2026` |
| Partite in corso | `liveData/scoreboard/todaysScoreboard_10.json` | Solo il giorno corrente, aggiornato durante la partita: stato e punteggio live senza riscaricare il calendario |
| Box score | `liveData/boxscore/boxscore_<gameId>.json` | Come per la NBA: minuti, tiri da 2 e da 3, liberi, rimbalzi, assist, recuperi, perse, stoppate fatte e subite, falli fatti e subiti, plus/minus, `starter`. Disponibile da quando la partita inizia |
| Roster | `staticData/playerIndex.json` | Tutte le giocatrici (14 KB): si filtra per `TEAM_ID` (0 = senza squadra). Ruolo, numero, altezza (`5-11`), nazione; il peso spesso manca. Niente data di nascita né allenatore |
| Foto e logo | `cdn.wnba.com/headshots/wnba/latest/260x190/<personId>.png` (CDN WNBA), `a.espncdn.com/i/teamlogos/wnba/500/<sigla>.png` (ESPN) | Il logo ufficiale è solo SVG con lo stesso nome per ogni squadra, quindi si usa quello ESPN. Le chiavi del manifest hanno il suffisso `?wnba` (nel nome del file `@`) per non coincidere con quelle NBA (`atl.png`, `<personId>.png`). I WebP inclusi nell'app (`assets/images/{teams,players}/wnba/`) li genera `scripts/download-images.mjs` dall'anagrafica: chi manca si carica dall'URL remoto (le foto non richiedono header) |

## Accesso: intestazioni da browser

Come `cdn.nba.com`, il dominio è dietro Akamai e risponde `403 Access Denied` ai client che non sembrano un browser. Verificato il
26/10/2026 con curl: calendario, tabellone, anagrafica e box score passano con le intestazioni di `NBA_HEADERS` (le stesse della NBA, definite
in `NbaLeagueSource.ts`) e danno 403 senza. `createSource` le passa al `FetchHttpClient` della WNBA. Valgono le stesse riserve:
**non provato da un dispositivo**, e Akamai può cambiare le regole in qualunque momento; per i server vedi `docs/backend.md`.
Il file del box score di `cdn.nba.com` non ha le partite WNBA: serve `cdn.wnba.com`.

## Id numerici

Squadra = `teamId` ufficiale (`1611661313`); giocatrice = `personId`. La partita non usa il `gameId` WNBA, che ESPN non conosce:
id = `AAAAMMGG * 10000 + indice casa * 100 + indice ospiti` (indici 1-15 in `teams.ts`), quindi le due fonti danno lo stesso id alla
stessa partita. `getBoxScore` decodifica l'id e risale al `gameId` dal calendario. Competizione `WNBA`, id `anno * 10 + 1`.
Le squadre sono una lista fissa (`teams.ts`, 15 nel 2026): una nuova squadra va aggiunta **in fondo** alla lista, altrimenti cambiano gli id
delle partite; finché manca, le sue partite sono saltate.

**Le giornate sono le settimane** (lunedì-domenica), contate dal lunedì della prima partita di Regular Season (`weeks.ts`); il numero
totale si ricava dall'ultima. `weekNumber` del calendario vale sempre 0, quindi non si può usare.

## Decisioni e limiti noti

- Solo Regular Season (`gameId` `102…`): precampionato (`101`), All-Star Game (`103`), playoff (`104`) e finale della Commissioner's Cup
  (`105`) sono scartati. Le partite del girone della Commissioner's Cup (stesso prefisso `102`) contano. Verificato sul 2026: 330 partite
  come con ESPN, con le stesse date, settimane e punteggi.
- **Tabellone playoff**: non passa da calendario e database. Il backend lo legge dal calendario ufficiale (`/v1/wnba/playoffs`, vedi `docs/api-backend.md`; `wnbaPlayoffs` su `OfficialPlayoffSource`,
  con `NBA_HEADERS`) e la home lo mostra al posto delle partite. Le partite `gameId` `104…` si raggruppano per turno (`gameLabel`: "First Round", "Semifinals", "WNBA Finals") e coppia di squadre;
  `homeTeam.wins`/`awayTeam.wins` sono le vittorie della serie e `seed` la testa di serie (1-8). La lunghezza della serie non è nel file: al meglio di 3, 5, 7 per turno (in `WnbaPlayoffSource.ts`).
  Se il CDN è guasto si ripiega su ESPN (`wnbaEspnPlayoffs`, senza teste di serie). In alto la squadra che ospita gara 1. Struttura fissa a 8 squadre (4 + 2 + 1 serie), con "Da definire" per quelle
  non ancora create. Verificato sui playoff 2026: stessi risultati con le due fonti.
- `postponedStatus: "Y"` non esclude una partita: una partita 2026 (NYL-DAL, 20/07) lo ha ed è stata giocata.
- Classifica calcolata dalle partite e ordinata per **percentuale di vittorie**; le prime 8 vanno ai playoff (nessuna conference).
- La valutazione (`rating`) è il PIR della EuroLeague, calcolato dal box score. A differenza di ESPN la fonte ufficiale pubblica falli
  subiti e stoppate subite.
- Allenatrice assente, data e luogo di nascita assenti (con ESPN c'erano).
- Il calendario si riscarica al più ogni 2 minuti; il tabellone (stato e punteggio live) ogni 10 secondi.
- La stagione WNBA (maggio-settembre) coincide con l'anno solare, ma l'app cambia stagione a luglio (`currentSeasonYear`): da gennaio
  a giugno si vede ancora l'anno precedente, e da luglio, finché il CDN non pubblica il nuovo calendario, la sincronizzazione segnala
  `Calendario WNBA … non ancora pubblicato`. Se il calendario è pubblicato ma ha solo il precampionato vale lo stesso messaggio.
- Il backup ESPN copre solo calendario e punteggi: box score e roster restano quelli già nel database.
- **Passaggio da ESPN alla fonte ufficiale**: gli id di partite, squadre e giocatrici sono cambiati. Il database dell'app ha un nome nuovo
  (`pallaadue-wnba-v2.db`); sul server va cancellato `wnba.db` prima della prossima sincronizzazione, altrimenti la stagione 2026
  avrebbe partite doppie (vedi `docs/server-setup.md`).
