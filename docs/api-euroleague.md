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

- Stato `live` dedotto: l'API non ha uno stato "in corso", quindi una partita non ancora `played` e iniziata da meno di 3 ore è
  considerata live. **Non verificato con una partita realmente in corso**: punteggio e box score live dipendono da come l'API li aggiorna.
- Solo la fase a gironi (`RS`): play-in, playoff, Final Four e fasi a eliminazione della EuroCup non sono gestiti.
- Zone in classifica: solo la EuroLeague evidenzia i primi 6 (playoff diretti); il play-in (7°-10°) non è marcato. Per la EuroCup nessuna zona (regolamento non verificato). Nessuna retrocessione.
- La classifica è calcolata dalle partite con l'ordinamento di `domain/standings.ts`, non con gli spareggi ufficiali della competizione.
- La città della partita non è disponibile; il nome del campo sì.
- Ruoli tradotti (Guard → Guardia, Forward → Ala, Center → Centro); la nazionalità resta in inglese.
