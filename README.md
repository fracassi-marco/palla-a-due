# Palla a Due 🏀

App Expo (iOS/Android) con classifica, prossime partite, roster e statistiche dei giocatori di LBA, Serie A2, Serie B Nazionale, EuroLeague, EuroCup, NBA e WNBA
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

## Sito (GitHub Pages)

Il sito vetrina è una pagina statica in `site/` (HTML e CSS, nessuna build): `index.html`, `privacy.html`, `termini.html`
e gli screenshot in `site/shots/`. Non è l'app in versione web: l'app non gira nel browser perché l'API della LBA non
ammette richieste cross-origin (CORS) e `expo-sqlite` sul web richiede header che GitHub Pages non può impostare.

### Provarlo in locale

```bash
cd site
python3 -m http.server 8080   # oppure, dalla radice: npx serve site
```

Apri http://localhost:8080 e controlla anche `/privacy.html` e `/termini.html`. Ogni modifica ai file si vede ricaricando la pagina.

### Rilasciarlo

Il workflow `.github/workflows/pages.yml` pubblica la cartella `site/` a ogni push su `main` che ne cambia i file
(si può lanciare a mano da **Actions → Deploy site → Run workflow**).

Una volta sola, nel repository su GitHub: **Settings → Pages → Source: GitHub Actions**.

Poi basta:

```bash
git add site && git commit -m "Aggiorna il sito" && git push
```

Il sito è su https://fracassi-marco.github.io/tutto-basket/ (il primo deploy richiede uno o due minuti; lo stato è nella
scheda Actions). Il pulsante "Scarica" rimanda alla pagina `releases/latest`, quindi funziona dopo la prima release con
tag `vX.Y.Z` (la crea `build-apk.yml`).

### Aggiornare gli screenshot

Con l'app aperta sull'emulatore Android (vedi sopra) si cattura con
`~/Library/Android/sdk/platform-tools/adb exec-out screencap -p > shot.png`; poi si ridimensiona e si salva in
`site/shots/` (JPEG, 720×1600 circa): `sips -Z 1600 -s format jpeg -s formatOptions 80 shot.png --out site/shots/<nome>.jpg`.

## Architettura esagonale

```
src/
├── domain/            # nucleo: nessuna dipendenza da React o dalla rete
│   ├── entities/      # Match, Standing, Roster, Player, PlayerProfile…
│   └── ports/         # interfacce: MatchRepository, StandingsRepository, TeamRepository…
├── application/       # casi d'uso: GetStandings, GetCurrentRound, GetTeamRoster… + SyncLeague (scarica solo ciò che manca)
├── infrastructure/
│   ├── api/           # ApiLeagueSource (rete) + dto + mappers + HttpClient
│   ├── fallback/      # FallbackLeagueSource: passa ai backup se la fonte principale si guasta
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

La NBA usa `NbaLeagueSource` sul CDN ufficiale `cdn.nba.com` (calendario, box score in diretta, giocatori); le giornate sono le settimane.
Dettagli, intestazioni richieste e limiti in `docs/api-nba.md`.

La WNBA usa `WnbaLeagueSource` su ESPN (tabellone, riepilogo partita, roster); le giornate sono le settimane. Dettagli in `docs/api-wnba.md`.

Se una fonte si guasta l'app passa a un backup (EuroLeague v1 per le coppe, TheSportsDB per i risultati di LBA e A2, ESPN per calendario e
punteggi della NBA); fonti,
copertura e limiti in `docs/api-backup.md`.
