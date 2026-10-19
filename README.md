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
├── application/       # casi d'uso: GetStandings, GetUpcomingMatches, GetTeamRoster, GetPlayerProfile
├── infrastructure/api # adattatori: ApiMatchRepository, ApiTeamRepository… + dto + mappers + HttpClient
├── di/container.ts    # composition root: lega porte e implementazioni
├── presentation/      # componenti, tema, hook
└── app/               # route Expo Router (adattatore di ingresso UI)
```

Per sostituire la sorgente dati (es. cache locale, mock) basta scrivere un'altra implementazione
delle porte e cambiarla in `di/container.ts`.

## Differenze rispetto a `docs/api.md`

Verificate sull'API reale (ottobre 2026):

| Dato | Endpoint effettivo |
|---|---|
| Competizione | `/championships/get-championships?s=<anno>` → Regular Season `ctype_code=RS`, `cserie_code=A1` |
| Classifica | `/championships/get-championship-ranking?id=<competitionId>` |
| Calendario | `/championships/get-championships-calendar-by-id?id=<competitionId>&d=<n. giornata>` (senza `d` = giornata corrente) |
| Roster | `/teams/get-team-roster?id=<teamId>` |
| Giocatore | `/players/get-player-stats?id=&s=` e `/players/get-player-matches?id=&s=` |
| Immagini | `https://lba-media.s3.eu-south-1.amazonaws.com/<key>` |

`get-standings`, `get-team-players` e `get-championships-matches-scores-by-id?id=<campionato>` della doc non
funzionano come descritto (redirect/404 o ID di partita). L'API è interna e non documentata: può cambiare.
