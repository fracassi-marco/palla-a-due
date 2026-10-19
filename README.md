# TuttoBasket 🏀

App Expo (iOS/Android) con classifica, prossime partite, roster e statistiche dei giocatori della LBA.

## Avvio

```bash
npm install
npx expo start   # poi `i` (iOS) o `a` (Android), oppure Expo Go
npm run typecheck
```

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

L'app chiama solo 4 endpoint (base `https://www.legabasket.it/api`), tramite `ApiLeagueSource`, e solo per ciò che
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
