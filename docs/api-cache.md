# API usate dall'app e cache

Base URL: `https://www.legabasket.it/api`

Tutte le chiamate passano da `CachedHttpClient` (`src/infrastructure/cache/`), che avvolge `FetchHttpClient`. Le risposte sono salvate su disco in `Paths.cache/http-cache/` (un file JSON per chiave), quindi la cache sopravvive alla chiusura dell'app. I TTL sono definiti in `src/infrastructure/cache/cachePolicy.ts`.

## Tabella delle API

| Endpoint | Parametri | A cosa serve | Schermate | TTL cache |
|---|---|---|---|---|
| `/championships/get-championships` | `s` (anno di inizio stagione) | Trova la competizione di Regular Season della stagione corrente (serve l'`id` per tutte le altre chiamate) | Home, Calendario | 24 ore |
| `/championships/get-championship-ranking` | `id` (competizione) | Classifica del campionato | Home, Calendario | 15 min |
| `/championships/get-championships-calendar-by-id` | `id` (competizione), `d` (giornata, opzionale) | Partite della giornata corrente (senza `d`) o di una giornata specifica (con `d`) | Home, Calendario | Dipende dal contenuto, vedi sotto |
| `/championships/get-championships-matches-scores-by-id` | `id` (partita) | Box score: statistiche dei giocatori di una partita in corso o conclusa | Partita | 60 s con dati, 30 s se vuoto |
| `/teams/get-team-roster` | `id` (squadra) | Roster di una squadra: giocatori e staff | Partita, Squadra | 12 ore |
| `/players/get-player-stats` | `id` (giocatore), `s` (stagione) | Statistiche stagionali del giocatore | Giocatore | 1 ora |
| `/players/get-player-matches` | `id` (giocatore), `s` (stagione) | Game log: statistiche del giocatore partita per partita | Giocatore | 1 ora |

`get-player-stats` e `get-player-matches` sono chiamate in parallelo dalla stessa schermata.

## TTL del calendario

Il TTL di `get-championships-calendar-by-id` viene calcolato sulla risposta:

| Stato della giornata | TTL |
|---|---|
| Tutte le partite concluse | 7 giorni (non cambia più) |
| Almeno una partita live | 30 s |
| Partite da giocare | Tempo che manca alla prima palla a due, tra 30 s e 30 min |
| Nessuna partita | 5 min |

## Comportamento della cache

- **Hit valido:** se la chiave (path + parametri ordinati) è in cache e non scaduta, nessuna richiesta di rete.
- **Scaduto:** si rifà la richiesta e si aggiorna la cache.
- **Rete assente o errore:** se c'è un dato scaduto, viene restituito quello; altrimenti l'errore arriva alla UI.
- **Richieste duplicate:** richieste identiche in volo contemporaneamente sono unificate in una sola.
- **Endpoint non elencati:** TTL 0, quindi nessuna cache.

## Limiti noti

- Il box score non contiene lo stato della partita: non si distingue una partita finita da una live, quindi anche quelle concluse vengono riscaricate ogni 60 s.
- `Paths.cache` può essere svuotata dal sistema operativo se manca spazio. In quel caso la prima richiesta successiva torna in rete.
