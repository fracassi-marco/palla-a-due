# Access log e statistiche del server

Caddy, davanti all'API, scrive un access log in JSON (una riga per richiesta) in `/var/log/caddy/access.log`, con
rotazione a 10 MB e 5 file conservati. La configurazione e i permessi sono in `docs/server-setup.md` (passo 7).
L'API (`server/src/api.ts`) non registra le richieste riuscite: nel journal (`journalctl -u palla-a-due-api`) finiscono
solo l'avvio e gli errori 502 con lo stack.

I comandi vanno eseguiti sul VPS, con `jq` installato (`sudo apt install -y jq`). Il file è leggibile solo dall'utente
`caddy` e da root, quindi serve `sudo`. Il file corrente copre solo le ultime richieste (i file ruotati si chiamano
`access-<data>.log`): per l'intero periodo usa `sudo cat /var/log/caddy/access*.log | jq ...`.

## Campi utili di ogni riga

| Campo | Contenuto |
|---|---|
| `.ts` | istante della richiesta (epoch, secondi con decimali) |
| `.status` | codice HTTP della risposta (200, 304, 404, 502...) |
| `.duration` | tempo di risposta in secondi |
| `.size` | byte inviati |
| `.request.method` | `GET` / `HEAD` |
| `.request.uri` | percorso e query, per esempio `/v1/lba/competitions?season=2026` |
| `.request.remote_ip` | IP del client |
| `.request.headers["User-Agent"][0]` | user agent |

Gli status più frequenti: **200** risposta nuova, **304** il client aveva già la risposta (ETag valido), **404** percorso o
risorsa inesistente, **405** metodo non consentito, **502** guasto a monte (la sorgente dati non ha risposto).

## Volume

```bash
# richieste totali
sudo jq -s length /var/log/caddy/access.log

# richieste per ora
sudo jq -r '.ts | strftime("%Y-%m-%d %H:00")' /var/log/caddy/access.log | sort | uniq -c

# richieste per giorno
sudo jq -r '.ts | strftime("%Y-%m-%d")' /var/log/caddy/access.log | sort | uniq -c

# richieste per minuto nell'ultima ora
sudo jq -r --argjson from "$(date -d '1 hour ago' +%s)" 'select(.ts>$from) | .ts | strftime("%H:%M")' /var/log/caddy/access.log | sort | uniq -c
```

## Esiti

```bash
# richieste per status
sudo jq -r .status /var/log/caddy/access.log | sort | uniq -c

# errori 5xx con orario e percorso
sudo jq -r 'select(.status>=500) | "\(.ts|todate) \(.status) \(.request.uri)"' /var/log/caddy/access.log

# 404 (percorsi sbagliati o scansioni)
sudo jq -r 'select(.status==404) | .request.uri' /var/log/caddy/access.log | sort | uniq -c | sort -rn | head

# percentuale di 304 (efficacia della cache ETag)
sudo jq -s '(map(select(.status==304))|length) / length * 100' /var/log/caddy/access.log
```

## Percorsi

```bash
# endpoint più richiesti (senza query string)
sudo jq -r '.request.uri | sub("\\?.*";"")' /var/log/caddy/access.log | sort | uniq -c | sort -rn | head -20

# richieste per campionato
sudo jq -r '.request.uri | capture("^/v1/(?<l>[^/]+)").l? // empty' /var/log/caddy/access.log | sort | uniq -c

# box score più richiesti (partite più seguite, utile durante le live)
sudo jq -r '.request.uri | select(test("box-score")) | sub("\\?.*";"")' /var/log/caddy/access.log | sort | uniq -c | sort -rn | head
```

## Prestazioni

```bash
# tempo di risposta medio e massimo, in millisecondi
sudo jq -s '{medio_ms: (map(.duration)|add/length*1000|round), max_ms: (map(.duration)|max*1000|round)}' /var/log/caddy/access.log

# 95° percentile
sudo jq -s 'map(.duration) | sort | .[(length*0.95|floor)] * 1000 | round' /var/log/caddy/access.log

# le 10 richieste più lente
sudo jq -r '"\(.duration*1000|round) ms \(.status) \(.request.uri)"' /var/log/caddy/access.log | sort -rn | head -10

# banda inviata, in MB
sudo jq -s 'map(.size)|add/1048576|round' /var/log/caddy/access.log
```

## Chi chiama

```bash
# IP più attivi (utile per notare abusi; con Cloudflare davanti saranno i suoi IP)
sudo jq -r .request.remote_ip /var/log/caddy/access.log | sort | uniq -c | sort -rn | head

# user agent più frequenti (l'app e i browser si distinguono da bot e scanner)
sudo jq -r '.request.headers["User-Agent"][0] // "-"' /var/log/caddy/access.log | sort | uniq -c | sort -rn | head
```

Il numero di IP distinti è solo una stima grezza degli utenti: più persone possono condividere un IP e lo stesso telefono
cambia IP tra Wi-Fi e rete mobile.

## Seguire il traffico in diretta

```bash
sudo tail -f /var/log/caddy/access.log | jq -r '"\(.ts|todate) \(.status) \(.duration*1000|round)ms \(.request.uri)"'
```

## Quando qualcosa non va

- Molti 502: guarda l'errore dell'API con `journalctl -u palla-a-due-api --since "1 hour ago" --no-pager`; la causa è di
  solito la sorgente dati a monte.
- Nessuna richiesta nel log ma l'app non carica: `systemctl status caddy palla-a-due-api` e `curl -i https://<hostname>/health`.
- Il log non si riempie dopo un reload di Caddy: controlla che `/var/log/caddy/access.log` appartenga a `caddy`
  (`ls -l /var/log/caddy`), vedi `docs/server-setup.md`.
