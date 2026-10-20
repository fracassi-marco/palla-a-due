# TuttoBasket 🏀

App Expo (iOS/Android) con classifica, prossime partite, roster e statistiche dei giocatori di LBA, Serie A2, Serie B Nazionale, EuroLeague ed EuroCup
(si sceglie dalla home; la LBA è il predefinito).

## Avvio

```bash
npm install
npx expo start   # poi `i` (iOS) o `a` (Android), oppure Expo Go
npm run typecheck
```

### Se l'app non parte su Android (emulatore con Expo Go)

Se compare `Cannot find native module 'ExpoSQLite'`, oppure Expo resta fermo su `› Reloading apps`, Expo Go è rimasto
bloccato su un bundle a metà. I comandi `adb` sono in `~/Library/Android/sdk/platform-tools/`.

```bash
adb shell am force-stop host.exp.exponent   # 1. chiude Expo Go; poi premi `a` nel terminale di Expo
adb shell pm clear host.exp.exponent        # 2. se persiste: cancella i dati di Expo Go (non quelli dell'app), poi `a`
```

Se non basta, aggiorna Expo Go dal Play Store dell'emulatore: la versione deve corrispondere all'SDK del progetto.
`adb devices` mostra se l'emulatore è collegato.

### Log delle chiamate HTTP

In sviluppo (`__DEV__`) ogni chiamata HTTP, a qualsiasi endpoint, stampa una riga con stato, durata ed eventuale `retry-after`:

```
[HTTP] 200 143ms GET https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games?limit=500
[HTTP] 429 31ms GET https://…/games/46/stats retry-after=300s
```

Compaiono nell'output di Expo; se lì mancano, il logcat di Android li riceve sempre:

```bash
adb logcat -s ReactNativeJS | grep HTTP
```

Non vedere nessuna riga è normale quando il database del campionato è già aggiornato: la sincronizzazione scarica solo ciò
che è scaduto. Per forzare le chiamate seleziona un campionato mai sincronizzato (es. EuroLeague). Le immagini caricate da
`expo-image` non passano da qui e non vengono registrate.

## Architettura esagonale

```
src/
├── domain/            # nucleo: nessuna dipendenza da React o dalla rete
│   ├── entities/      # Match, Standing, Roster, Player, PlayerProfile…
│   └── ports/         # interfacce: MatchRepository, StandingsRepository, TeamRepository…
├── application/       # casi d'uso: GetStandings, GetCurrentRound, GetTeamRoster… + SyncLeague (scarica solo ciò che manca)
├── infrastructure/
│   ├── api/           # ApiLeagueSource (rete) + dto + mappers + HttpClient
│   └── db/            # SQLite: schema, migrazioni, repository di lettura e store di scrittura
├── di/container.ts    # composition root: lega porte e implementazioni
├── presentation/      # componenti, tema, hook
└── app/               # route Expo Router (adattatore di ingresso UI)
```

Le schermate leggono solo dal database locale (vedi `docs/local-database.md`); per sostituire la sorgente dei
dati basta scrivere un'altra implementazione di `LeagueSource` e cambiarla in `di/container.ts`.

## API usate

Per la **LBA** l'app chiama solo 4 endpoint (base `https://www.legabasket.it/api`), tramite `ApiLeagueSource`, e solo per ciò che
il database locale non ha ancora (dettagli e tempi in `docs/local-database.md`):

| Dato | Endpoint |
|---|---|
| Competizione | `/championships/get-championships?s=<anno>` → Regular Season `ctype_code=RS`, `cserie_code=A1` |
| Calendario | `/championships/get-championships-calendar-by-id?id=<competitionId>&d=<n. giornata>` |
| Box score | `/championships/get-championships-matches-scores-by-id?id=<matchId>` |
| Roster | `/teams/get-team-roster?id=<teamId>` |
| Immagini | `https://lba-media.s3.eu-south-1.amazonaws.com/<key>` (caricate dal componente immagine, non da `HttpClient`) |

Classifica, statistiche squadra e giocatore e game log non vengono più scaricati: sono calcolati dal database.
Rispetto a `docs/api.md`, `get-standings`, `get-team-players` e `get-championships-matches-scores-by-id?id=<campionato>`
non funzionano come descritto (redirect/404 o ID di partita). L'API è interna e non documentata: può cambiare.

Serie A2 e B Nazionale (LNP) usano `LnpLeagueSource`: calendario in JSON, box score e roster letti dalle pagine HTML del
sito. Dettagli, endpoint e limiti in `docs/api-lnp.md` (gli endpoint ipotizzati `/api/matches` e `/api/standings` non esistono).

EuroLeague ed EuroCup usano `EuroleagueLeagueSource` sull'API ufficiale di Euroleague Basketball (JSON). Dettagli e limiti in
`docs/api-euroleague.md`.
