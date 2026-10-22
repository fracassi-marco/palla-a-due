# Dati di EuroLeague ed EuroCup

API ufficiale di Euroleague Basketball, JSON, senza chiave: `https://api-live.euroleague.net/v2/competitions/<coppa>/seasons/<coppa><anno>/…`
con coppa `E` (EuroLeague) o `U` (EuroCup) e anno di inizio stagione (2026/27 → `E2026`). Implementazione:
`src/infrastructure/euroleague/` (`EuroleagueLeagueSource`). Una sola fonte per entrambe, parametrizzata da `series.ts`.

| Dato | Endpoint | Note |
|---|---|---|
| Calendario e risultati | `…/games?limit=500[&roundNumber=<n>]` | Tutta la stagione in una pagina. `phaseType.code` = `RS` (fase a gironi); `group.order`/`rawName` = girone; `utcDate` in UTC; `played` booleano |
| Box score | `…/games/<gameCode>/stats` | `local`/`road` → `players[]` + `total`; prima della palla a due `players` è vuoto e `total` nullo. `timePlayed` in secondi |
| Club | `…/clubs?limit=500` | Serve a risalire dall'id numerico al codice club |
| Roster | `…/clubs/<codice>/people` | Array; `type` `J` giocatore, `E` allenatore (gli assistenti sono `A`); foto in `images.headshot` |

Nomi: `COGNOME, NOME` in maiuscolo (convertiti in "Nome Cognome"). La stagione 2026/27 ha EuroLeague a 20 squadre (1 girone, 38 giornate)
ed EuroCup a 32 (4 gironi da 8, 14 giornate): ogni girone è una competizione dell'app, come i gironi della Serie B.

## Id numerici

Come per LNP (`euroleague/ids.ts`): competizione = `anno(2 cifre) * 10 + group.order`; partita = `competizione * 100000 + gameCode`
(decodificabile per scaricare il box score); club = hash stabile del codice (`BAR`); persona = codice numerico (`006590` → 6590)
oppure hash fuori intervallo (`BEY`). EuroLeague ed EuroCup hanno ciascuna il proprio database, quindi gli id possono coincidere.

## Limiti noti

- Stato `live` dedotto: l'API v2 non ha uno stato "in corso", quindi una partita non ancora `played` e iniziata da meno di 3 ore è
  considerata live. Durante la partita però v2 dà punteggio 0-0 e box score vuoto: per questo si usa il feed del sito live
  (non documentato, verificato il 21/10/2026 con una partita di EuroCup in corso): `https://live.euroleague.net/api/Header?gamecode=<n>&seasoncode=U2026`
  (`ScoreA`/`ScoreB`, A = casa, `Live`) e `.../api/Boxscore?...` (`Stats[0]` casa, `Stats[1]` ospiti; `Player_ID` = "P" + codice persona).
  Se il feed non risponde si resta sui dati v2. Esiste anche `.../api/PlayByPlay`, non usato.
- Solo la fase a gironi (`RS`): play-in, playoff, Final Four e fasi a eliminazione della EuroCup non sono gestiti.
- Zone in classifica: solo la EuroLeague evidenzia i primi 6 (playoff diretti); il play-in (7°-10°) non è marcato. Per la EuroCup nessuna zona (regolamento non verificato). Nessuna retrocessione.
- La classifica è calcolata dalle partite con l'ordinamento di `domain/standings.ts`, non con gli spareggi ufficiali della competizione.
- La città della partita non è disponibile; il nome del campo sì.
- Ruoli tradotti (Guard → Guardia, Forward → Ala, Center → Centro); la nazionalità resta in inglese.

## Backup

Se la v2 si guasta (rete, 5xx, 429, formato inatteso) si usa la v1 XML (`EuroleagueV1LeagueSource`), con gli stessi id: endpoint, differenze e limiti in `docs/api-backup.md`.
