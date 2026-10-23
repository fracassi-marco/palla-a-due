# Backend per i dati dei campionati — analisi e piano

Analisi (non implementata) sull'introduzione di un backend che scarica i dati dalle sorgenti (vedi `docs/openapi.yaml` e
`docs/api-backup.md`) e li espone alla app, al posto delle chiamate dirette dai dispositivi.

Data analisi: 2026-10-22. Stato: **cron di sincronizzazione implementati in `server/`** (SQLite, un file per campionato, provati
sulle sorgenti reali); **API di lettura e `BackendLeagueSource` implementati per l'LBA** (vedi `docs/api-backend.md`); poller live non ancora (lo sostituisce una cache in memoria). Direzione scelta: **VPS proprio** (vedi "Architettura scelta"),
senza Cloudflare davanti all'inizio. Il test degli IP dal VPS è passato (vedi "Test delle sorgenti dal VPS"). Una prova
su Cloudflare Workers è stata fatta e rimossa (vedi "Prova su Cloudflare").

## Contesto

Oggi la app chiama direttamente le sorgenti da ogni dispositivo (`src/infrastructure/`, `FetchHttpClient`):

| Campionato | Principale | Backup |
|---|---|---|
| LBA | `legabasket.it/api` | TheSportsDB |
| Serie A2 | `lnpstat.domino.it` + HTML LNP | TheSportsDB |
| Serie B Nazionale | `lnpstat.domino.it` + HTML LNP | – |
| EuroLeague / EuroCup | Euroleague v2 (+ feed live) | Euroleague v1 (XML) |
| NBA | `cdn.nba.com` | ESPN |

Il fallback (rete, 5xx, 408, 429, formato inatteso) è lato client in `FallbackLeagueSource`. Parte delle sorgenti richiede
scraping HTML o parsing XML sul telefono.

## Perché un backend

- **Correggere le rotture senza rilasciare una build.** Se LNP cambia l'HTML o legabasket.it cambia lo schema, oggi serve
  una release passando dagli store (ore o giorni). Con il backend basta un deploy. È il vantaggio principale e vale già
  con pochi utenti.
- **Meno carico sulle sorgenti.** N utenti sulla stessa partita non producono N richieste a legabasket.it: il backend
  scarica una volta. Riduce il rischio di rate limit (429) e ban, rilevante da qualche centinaio di utenti attivi.
- **Fallback e normalizzazione centralizzati.** Il client vede un solo formato e non sa quale sorgente ha risposto;
  parsing di HTML, XML e dei diversi JSON fuori dalla app (meno bundle, CPU e batteria).
- **Chiavi API** (se arriveranno sorgenti con chiave) restano sul server.

Rischi generali: il backend diventa un punto di guasto (tenere nel client un fallback diretto minimo almeno durante la
transizione); aspetti legali (servire a molti utenti dati scrapati dal proprio server è più visibile: controllare i
termini d'uso delle sorgenti); manutenzione (evitare parser duplicati tra app e backend).

## Architettura scelta

Principi:

- **Solo i cron aggiornano il database; le API leggono e basta**, esponendo i dati grezzi.
- **Consolidato → database. Live → database o altro storage** (memoria, tabella `live`).
- **Un cron al giorno per campionato** scarica risultati e tabellini consolidati delle partite fino al giorno prima.
- **La app calcola i dati derivati** (vedi "Calcoli derivati").

Infrastruttura: **VPS proprio** (Ubuntu 26.04 LTS, 2 vCore, 4 GB RAM, 160 GB NVMe). Più che sufficiente: una stagione di
tutti i campionati con i box score pesa decine di MB. Ubuntu 26.04 ha aggiornamenti di sicurezza standard fino ad aprile
2031. La guida all'installazione è in `docs/server-setup.md`.

- **Un solo processo Node o Bun** (TypeScript, come la app) con un router leggero (es. Hono).
- **Riuso del codice della app**: i file puri di `src/infrastructure/lnp`, `euroleague`, `nba` e i `mappers` si importano
  direttamente. Nessun limite di CPU, quindi il parsing HTML dei tabellini non è un problema.
- **SQLite in modalità WAL con lo stesso schema della app** (`src/infrastructure/db/schema.ts`), un file per campionato come nella app (gli id non si mescolano).
- **Cron giornalieri per campionato** (`systemd timers` o `cron`), con upsert idempotenti.
- **Live nello stesso processo**: un poller ogni 30-60 s che parte solo nelle fasce con partite in corso e tiene il
  risultato in memoria o in una tabella `live`. L'API continua a leggere solo dati già scritti.
- **API in sola lettura** che espone i dati grezzi, con contratto versionato (`/v1/...`) che include `source` e
  `updatedAt`.
- **Caddy** davanti, con HTTPS automatico (Let's Encrypt). **HTTPS è obbligatorio**: gli iOS di produzione bloccano
  l'HTTP in chiaro (App Transport Security) e Android lo blocca di default dalla versione 9. Serve un hostname (un
  sottodominio con record A verso il VPS; `<ip>.sslip.io` funziona ma è più fragile).
- **Senza Cloudflare all'inizio**: a questa scala SQLite in lettura regge senza cache. L'API manda comunque
  `Cache-Control` ed `ETag` dal primo giorno; **Cloudflare gratuito come proxy con cache** si aggiunge dopo mettendo
  il record DNS in modalità proxy, senza toccare il codice: i dati consolidati sono immutabili e si cachano per ore, e
  con `stale-if-error` gli utenti vedono l'ultimo dato anche se il VPS è giù.
- **L'IP del VPS è esposto**: `ufw` aperto solo su 22, 80 e 443, SSH solo con chiave, `fail2ban`,
  `unattended-upgrades`, rate limiting nell'API.
- **Backup**: Litestream su un bucket (R2, B2) oppure copia notturna del file SQLite fuori dal VPS.
- **Monitoraggio**: ping a un servizio tipo healthchecks.io a fine di ogni cron e un endpoint con `lastSyncedAt` per
  campionato (un cron fallito altrimenti è silenzioso).

### Problemi da gestire

1. **Un cron giornaliero non copre "oggi".** Fino al cron successivo le partite finite oggi non sono nel DB: serve un
   percorso per "oggi" (il poller live, o un cron leggero nelle fasce di gara).
2. **"Consolidato" si decide per stato, non per data.** Le partite NBA finiscono verso le 6 in Italia: il cron NBA va
   messo la tarda mattina. I box score LNP possono comparire con ritardo: serve una finestra di riprova per le partite
   finite senza tabellino (la app lo fa già con `box_score_final`, riprova ogni 30 minuti per 14 giorni).
3. **Possibili correzioni di statistiche nei giorni successivi**: riscaricare le ultime N giornate.
4. **Gli IP di datacenter possono essere bloccati dalle sorgenti.** Provato dal VPS il 2026-10-22: nessun blocco (vedi
   "Test delle sorgenti dal VPS"), ma una sorgente può cambiare politica: i cron devono segnalare i 403/429.
5. **Il VPS è un punto di guasto e la manutenzione è tua**: aggiornamenti di sicurezza, riavvii, disco, backup.
6. **Versionamento dell'API**: vecchie versioni della app devono continuare a funzionare.

## Calcoli derivati: app o backend

**Principio**: calcolare nell'app ciò che è una funzione pura dei dati grezzi e ha regole stabili; prendere dal backend
ciò che dipende da decisioni esterne o da regole che possono cambiare.

Nell'app:

- Statistiche derivate (forma ultime 5, media punti fatti/subiti, differenza canestri, casa/trasferta, serie).
- **Classifica live/proiettata** con i punteggi provvisori. Mostrarla come "provvisoria".
- Filtri e viste (solo casa, ultime N giornate, scontri diretti) senza un endpoint per ogni combinazione.
- Funziona offline con la cache; il backend serve partite e risultati grezzi e il contratto resta piccolo.

**Classifica ufficiale: se la sorgente la fornisce, usare quella** (tramite backend). Il calcolo locale resta fallback
e per la proiezione live. Motivo: le classifiche reali hanno casi non derivabili dai risultati grezzi:

- penalizzazioni (punti tolti), sconfitte a tavolino, partite non giocate/rinviate;
- spareggi diversi per campionato (scontro diretto, classifica avulsa a più squadre, differenza canestri; la NBA ha
  divisioni e conference);
- gironi e fasi (Serie B Nazionale, EuroCup), squadre ritirate o escluse.

Implementazione: logica di calcolo in un **modulo di funzioni pure** in TypeScript, senza dipendenze da React Native,
riusabile nel backend; test delle regole di spareggio per campionato con casi reali. Da verificare nel codice come la
app calcola oggi la classifica.

## Cache lato app

Va mantenuta, soprattutto per l'esperienza d'uso.

- **Stale-while-revalidate sul client**: mostrare subito il dato in cache e aggiornare in background.
- **TTL allineati al server, mai più lunghi** (live 15-30 s, classifiche/calendari 5-15 min, rose/storico ore). Due
  cache con TTL non allineati sommano la vecchiaia del dato.
- **Persistenza su disco** (`AsyncStorage` o MMKV) per i dati lenti; non per il live.
- **Richieste condizionali**: `Cache-Control` ed `ETag` dal server, `If-None-Match` dal client (304 senza body).
- **Polling intelligente**: live solo con schermata in primo piano e app attiva, fermo in background e quando non ci
  sono partite.
- **Mostrare l'età del dato** ("aggiornato 2 min fa"). Non scrivere un sistema di cache proprio.
- Immagini: loghi e foto sono già versionati nella app (`resolveImageSource` confronta l'ultimo segmento dell'URL con
  `src/infrastructure/images/manifest.ts`); se il backend espone `logoUrl`, l'estensione del file deve coincidere con
  quella usata dal manifest (in LNP cambia da squadra a squadra e sta solo nella pagina elenco squadre).

## Alternative valutate (piani free)

I numeri vengono in parte da blog di terzi: verificare sulle pagine ufficiali prima di scegliere.

- **GitHub Actions per i cron**: 2.000 minuti/mese nei repo privati, nessun limite di CPU; cron minimo 5 minuti con
  ritardi anche di decine di minuti (irrilevante per un cron giornaliero). Da verificare: disabilitazione dopo 60 giorni
  di inattività del repo e comportamento nei repo privati del piano personale.
- **Cloudflare D1 + Worker per DB e API**: D1 è SQLite, come il database locale della app; letture native dal Worker con
  Cache API. Il limite è la CPU del Worker (vedi prova sotto), quindi i cron pesanti vanno altrove.
- **Supabase**: Postgres con API REST senza codice e `pg_cron`. Free: 500 MB, pausa dopo ~7 giorni senza richieste, 2
  progetti, Edge Functions con 2 s di CPU. Diverso dal SQLite della app.
- **Turso** (libSQL): free con 5 GB, 500 M righe lette e 10 M scritte al mese; oltre le quote le query falliscono
  (`BLOCKED`). **Neon**: Postgres con scale-to-zero (~0,5-1 GB, 100 CU-ore), serve comunque un layer API.
- **Vercel Hobby**: cron solo una volta al giorno. **Oracle Always Free / altre VM**: come il VPS ma da manutenere.
- **Dati consolidati come file JSON statici** (R2, GitHub Pages) generati dal cron: senza DB né API per lo storico,
  restando da fare solo il percorso "oggi". Alternativa più semplice, da tenere presente.

Il VPS già in possesso è stato preferito perché elimina i limiti (CPU, subrequest, numero di cron, quote) e permette di
tenere il live nello stesso processo.

## Test delle sorgenti dal VPS (2026-10-22)

Una richiesta per sorgente, lanciata dal VPS (curl, header della app solo per la NBA):

- **200 da tutte**: LBA (competizioni), LNP (calendario JSON, classifica JSON, elenco squadre HTML, box score HTML),
  Euroleague (v2 calendario, v1 calendario, live header), NBA (calendario e tabellone con gli header di `NBA_HEADERS`),
  ESPN NBA, TheSportsDB. Tempi 0,1-0,3 s.
- **NBA senza header: 403**, come previsto: servono tutti gli header di `NBA_HEADERS` (con una lista parziale, per
  esempio senza `sec-fetch-*` e `sec-ch-ua`, risponde ancora 403).
- **Calendario NBA lento una volta**: 6,5 s dal VPS contro 0,24 s da un altro ambiente (413 KB, un solo campione): da
  ripetere; nei cron va previsto un timeout ampio.
- Non è stato provato un volume realistico (rate limit) né il box score LBA / Euroleague v2 / NBA.

## Prova su Cloudflare (2026-10-22, A2 e Serie B)

Un Worker con due cron (controllo frequente ogni 5 minuti, scansione del calendario) scriveva in D1. Il codice non è
stato conservato; Worker e database D1 sono stati eliminati da Cloudflare.

- **`lnpstat.domino.it` risponde agli IP Cloudflare**: nessun blocco per LNP.
- **Il calendario LNP è JSON**, non HTML: HTML solo per box score, roster ed elenco squadre.
- **CPU misurata** (`wrangler tail`, campo `cpuTime`): controllo frequente senza giornate attive 1-2 ms; scansione di
  ~300 partite (10 giornate × 3 gironi) **30-72 ms** per esecuzione, cioè 3-7 volte il limite Free di 10 ms. Nessuna
  esecuzione è fallita: o l'account non era sul Free o il limite non è applicato come da documentazione (non
  verificato). Stima: ~0,1-0,25 ms per partita (non misurato dove va il tempo). Per rientrare nei 10 ms servirebbero
  ~30-40 partite per esecuzione.
- **Limiti Free verificati sulla documentazione**: 50 subrequest per invocazione **D1 compreso**; 10 ms di CPU anche
  per i cron; 5 cron per account; D1 massimo 100 parametri per query e 500 MB per database; con il piano a pagamento
  1.000 subrequest/query per invocazione.
- **I cron modificati impiegano circa 10 minuti a diventare attivi** dopo il deploy.
- Upsert che non toccano le righe invariate (`ON CONFLICT … DO UPDATE … WHERE col IS NOT excluded.col`) evitano
  scritture inutili sul database.
- Strumenti: `wrangler dev --test-scheduled` e `/__scheduled?cron=…` per provare i cron; `wrangler tail --format json`
  per CPU e log di ogni esecuzione. In questa shell `npm`/`node` sono wrapper nvm rotti: servono i percorsi assoluti
  (`/opt/homebrew/bin/npm`).

## Prossimi passi

1. ~~Test degli IP dal VPS~~ (fatto, vedi sopra). Resta da ripetere il calendario NBA (6,5 s) e provare un volume
   realistico di richieste, compresi i box score di LBA, Euroleague v2 e NBA.
2. Decidere: sottodominio per l'API (record A verso il VPS), servizi già presenti sul VPS (porte 80/443), dove salvare i
   backup (bucket R2/B2 con Litestream o copia notturna), hardening di base (`ufw`, SSH con chiave, `fail2ban`).
3. Implementare **un solo campionato (Serie A2)** con cron giornaliero, SQLite con lo schema della app e API di
   lettura; poi il poller live.
4. Definire il contratto `/v1` partendo dai tipi di dominio e da `docs/openapi.yaml`, con `source` e `updatedAt`.
5. Aggiungere un `BackendLeagueSource` nella app (con la sorgente diretta come ultimo fallback), poi gli altri
   campionati; monitoraggio dei cron e backup prima di rimuovere i fallback diretti.
6. Controllare come la app gestisce oggi i dati (hook, store, libreria di fetching) per capire se esiste già una cache.
