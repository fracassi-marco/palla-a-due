# Fonti di backup

Ogni campionato ha una fonte principale (`LeagueSource`, vedi `docs/api*.md`). Se si guasta, `FallbackLeagueSource`
(`infrastructure/fallback/`) passa ai backup in ordine, e la sincronizzazione continua a salvare nel database locale come
sempre. Cablaggio in `di/container.ts`.

Si passa al backup solo per un **guasto**: errore di rete, risposta 5xx/408/429 o dati in un formato che il mapper non
capisce. Una richiesta sbagliata (404 e simili) non è un guasto e non cambia fonte. Dopo un guasto la principale non viene
ritentata per 60 s: le richieste vanno direttamente ai backup. Se falliscono anche i backup, l'errore restituito è quello
della principale (un backup può coprire solo una parte dei dati e rifiutare il resto).

| Campionato | Principale | Backup | Cosa copre il backup |
|---|---|---|---|
| LBA | `legabasket.it/api` | TheSportsDB (lega 4433) | Stato e punteggio delle partite già nel database |
| Serie A2 | `lnpstat.domino.it` + HTML LNP | TheSportsDB (lega 5377) | Come LBA |
| Serie B Nazionale | `lnpstat.domino.it` + HTML LNP | nessuno | – |
| EuroLeague / EuroCup | API v2 `api-live.euroleague.net` | API v1 `api-live.euroleague.net/v1` | Tutto: competizioni, calendario, punteggi, box score, roster |
| NBA | `cdn.nba.com/static/json` | Tabellone ESPN `site.api.espn.com` | Calendario, stato e punteggi (anche live) |

## Euroleague API v1 (`EuroleagueV1LeagueSource`)

XML, senza chiave, stessa infrastruttura della v2 e stessi codici (club `BAR`, persona `006590`, `E2026_7`): gli id numerici
dell'app coincidono con quelli della v2, quindi i dati dei due sorgenti si mescolano nel database senza duplicati.
XML letto con `euroleague/xml.ts` (espressioni regolari: React Native non ha `DOMParser`).

| Dato | Endpoint (`?seasonCode=E2026`) | Note |
|---|---|---|
| Calendario | `/v1/schedules` | `round` = fase (`RS`), `gameday` = giornata, `group` = `Regular Season` o lettera del girone (A→1, B→2…, stesso ordine della v2), `date` + `startime` in ora dell'Europa centrale, `played` |
| Punteggi | `/v1/results` | Solo partite giocate (`homescore`/`awayscore`); in corso: feed `live.euroleague.net` come per la v2 |
| Box score | `/v1/games?gameCode=<n>` | `localclub`/`roadclub` → `<stat>` per giocatore (la riga `Team`, codice 0, è scartata) e `<totals>`; minuti da `TimePlayedSeconds` |
| Club e roster | `/v1/teams` | Un solo documento con tutti i club: nome, codice TV, allenatore, `members` (`profile` `J` = giocatore, `active`) |

Verificato il 22/10/2026 contro la v2: stessi id, stato, punteggi, orari, campi e statistiche (box score della gara 7 della
EuroLeague, giornate 1 e 3 di EuroLeague ed EuroCup, roster di Barcellona).

Differenze rispetto alla v2:
- nessuna foto, logo, altezza, peso o data di nascita: il database mantiene quelli già salvati (`COALESCE` in
  `SqliteLeagueStore.saveRoster`, `upsertTeam`);
- i nomi squadra sono quelli completi ("Aris Thessaloniki"), non abbreviati come nella v2 ("Aris"): tornano quelli della v2 al
  primo download di una giornata con la fonte principale;
- gira sullo stesso server: protegge da un guasto o da un cambio di formato della v2, **non** da un blocco del server o da un
  429 per limite di richieste (condiviso).

## TheSportsDB (`TheSportsDbLeagueSource`)

JSON, chiave pubblica `123` (`https://www.thesportsdb.com/api/v1/json/123`). Usata solo `eventsround.php?id=<lega>&r=<giornata>&s=2026-2027`
(l'intera giornata, con `intRound` uguale al numero di giornata dell'app). Id di lega: LBA 4433, Serie A2 5377.

Ha id propri per squadre e partite e non ha box score né roster, quindi **non può creare** partite o squadre: legge dal database
le partite note della giornata (`MatchRepository.getMatchesByDay`) e le abbina agli eventi per nome delle squadre
(`teamNames.ts`: parole in comune, anche per prefisso di 5 lettere, "Trento" ↔ "Dolomiti Energia Trentino"). Se resta una sola
partita senza abbinamento e un solo evento, e le date distano al più 3 giorni, sono la stessa. Una partita abbinata prende
punteggio e stato (`FT`/`AOT` = conclusa); una `scheduled` prima della palla a due, o già conclusa, resta com'è.
Con il database senza calendario (primo avvio a fonte principale spenta) il backup rifiuta.

Verificato il 22/10/2026 sulla 4ª giornata LBA: 8 partite su 8 abbinate, punteggi identici a quelli dell'API LBA.

Limiti:
- chiave pubblica con limite di richieste basso (risposta 429, Cloudflare 1015): richieste una alla volta a 1,5 s e giornata in
  cache 60 s. Una sincronizzazione completa a fonte principale spenta è quindi lenta;
- nessun dato live (`strStatus` diverso da `FT` solo se ci sono punteggi: la partita appare live, ma TheSportsDB di solito
  aggiorna il risultato a fine partita);
- box score e roster non hanno backup: durante un guasto della principale falliscono e compaiono nell'errore di sincronizzazione.

## ESPN per la NBA (`NbaEspnLeagueSource`)

JSON, senza chiave né protezioni: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=<AAAAMMGG>`
(partite del giorno a ora della costa Est, con stato `pre`/`in`/`post`, punteggio, orario UTC, campo). L'intervallo di date
(`dates=a-b`) e `limit` rispondono 400: una richiesta per giorno, sette per giornata (8 KB l'una), in parallelo.

ESPN **può creare** partite e competizioni, perché l'id numerico di una partita dipende solo da data e squadre (vedi `docs/api-nba.md`);
le squadre si associano alla tabella fissa di `nba/teams.ts` per sigla (ESPN scrive `GS`, `NO`, `NY`, `SA`, `UTAH`, `WSH`). Le settimane
si calcolano da data e anno come per la fonte principale. Scartati gli eventi non di Regular Season (`season.type` ≠ 2), quelli con
squadre `TBD` e i turni a eliminazione della NBA Cup (`notes`: "NBA Cup - Quarterfinals…").

Verificato il 22/10/2026 contro la fonte principale su tutta la stagione: 1.200 partite, stesso id, stato, punteggio e settimana in 1.200 casi
su 1.200; l'orario di inizio differisce in un caso (20 minuti).

Limiti: **box score e roster non sono disponibili** (ESPN ha id propri per i giocatori, non associabili ai `personId` NBA già nel
database senza confrontare i nomi, e creerebbe duplicati): durante un guasto della principale falliscono e compaiono nell'errore di
sincronizzazione. Il backup non protegge dalla stessa causa di guasto di rete del dispositivo.

## Valutate e scartate

| Fonte | Esito |
|---|---|
| Kambi (`eu-offering-api.kambicdn.com`, quote Unibet) | JSON pubblico, ha la EuroLeague con `state`; non ha LBA né EuroCup maschile, il live non verificato (nessuna partita aperta), termini d'uso poco chiari |
| SofaScore (`api.sofascore.com`) | Non risponde a client non-browser; non ufficiale e a rischio ToS |
| ESPN (altre leghe) | Nessuna di queste leghe; per la NBA è il backup |
| API-Basketball (api-sports.io) | Copre LBA e altre; chiave a registrazione e piano gratuito di 100 richieste al giorno, troppo poche per un refresh ogni 30 s. Non verificata |
| Genius Sports / FIBA LiveStats (`fibalivestats…/data.json`) | Nessun riferimento nelle pagine LNP: non si sa se Serie A2/B lo usino. Sarebbe il candidato per box score e live della LNP |
| NBA `stats.nba.com` (`commonteamroster`, `leaguestandingsv3`, `boxscoretraditionalv3`) | Rispondono da un browser su nba.com ma non a curl (timeout): più ostile del CDN; non usato. Servirebbe per l'allenatore e per la classifica per conference |
| NBA `cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json` | Stesso contenuto del `scheduleLeagueV2.json` (7 MB), nessun vantaggio |
