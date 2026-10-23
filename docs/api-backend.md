# API del backend (`/v1`)

API di sola lettura servita da `server/src/api.ts` (Node, `node:http`, nessuna dipendenza oltre a `better-sqlite3`), in ascolto
su `127.0.0.1:3000` dietro Caddy (HTTPS). Ha la stessa forma di `LeagueSource`: la app la legge con `BackendLeagueSource`
(`src/infrastructure/backend/`). Per i campionati migrati la app **non ripiega** sulle sorgenti esterne: se il backend non
risponde, la sincronizzazione fallisce e riprova alla successiva, mentre le schermate continuano a leggere il database locale.
Il perché è in `docs/backend.md`.

## Percorsi

`{league}` = `lba | a2 | b | euroleague | eurocup | nba`. Solo `GET`.

| Percorso | Risposta (`data`) |
|---|---|
| `/health` | `{status:"ok"}` (senza busta) |
| `/v1/{league}/competitions?season=YYYY` | `Competition[]` con `totalDays` (default: stagione corrente) |
| `/v1/{league}/competitions/{id}/days/{n}` | `Match[]` (le date sono ISO 8601) |
| `/v1/{league}/matches/{id}/box-score` | `MatchBoxScore` |
| `/v1/{league}/teams/{id}/roster` | `Roster` |

I tipi sono quelli di `src/domain/entities`. Ogni risposta è `{ source: "db" | "live", updatedAt, data }`; errori: `404`
(campionato o risorsa sconosciuti), `502` (sorgente non raggiungibile e niente nel database), `405`.

## Da dove arrivano i dati

- **Consolidato → database** (scritto dai cron): competizioni, giornate con tutte le partite concluse, box score definitivi
  (`box_score_final`), roster. `source: "db"`, `Cache-Control: public, max-age=3600`.
- **Ancora variabile → sorgente, con cache in memoria**: giornate non concluse (15 s se c'è una partita live, 5 min
  altrimenti), box score live (15 s) o non definitivi (5 min). `source: "live"`. Le richieste simultanee sulla stessa risorsa
  scaricano una volta sola. Se la sorgente non risponde si serve l'ultima copia del database, se esiste.
- Dati che il cron non ha ancora scaricato (database vuoto): stesso percorso "sorgente con cache".
- Le risposte hanno `ETag`; con `If-None-Match` torna `304`.

Il poller live dedicato (vedi `docs/backend.md`) non c'è ancora: la cache in memoria ne fa le veci.

## Esecuzione

```bash
cd server && npm ci && npm run api        # build + http://127.0.0.1:3000, database in server/data/
```

Variabili: `DATABASE_DIR` (obbligatoria in produzione), `PORT` (3000), `HOST` (127.0.0.1).

## Nella app

`src/di/container.ts`: `BACKEND_LEAGUES` elenca i campionati serviti dal backend (ora `lba` e `nba`); `EXPO_PUBLIC_API_URL`
cambia l'URL di base (default `https://043q46l.cserverhost.cloud`) e, se vuoto, disattiva il backend (la app torna alle sorgenti dirette: serve per lo sviluppo). Timeout richiesta: 8 s.
Per aggiungere un campionato basta inserirlo in `BACKEND_LEAGUES` dopo aver fatto girare il suo cron.

## Immagini

Loghi e foto non passano dal backend: sono incluse nella app (`assets/images`, `manifest.ts`). Il backend restituisce gli URL
originali dei CDN, usati solo per ciò che nel manifest manca. Per aggiornarle ogni tanto:

```bash
npm run images:check     # elenca le immagini nuove (non scarica nulla; codice di uscita 1 se ce ne sono)
npm run images:update    # le scarica, le converte in WebP (serve `cwebp`: brew install webp) e rigenera il manifest
```

Poi si versionano `assets/images` e `src/infrastructure/images/manifest.ts` e si rilascia la build.
