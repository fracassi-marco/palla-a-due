# Setup del server (VPS Ubuntu 26.04 LTS)

Cosa predisporre sul VPS per far girare i cron che popolano il database SQLite e, più avanti, l'API di lettura. Il
perché delle scelte è in `docs/backend.md`. Il codice dei cron è in `server/` (vedi passo 5); l'API di lettura è in `server/src/api.ts` (vedi `docs/api-backend.md`).

Convenzioni usate sotto (sostituisci i valori tra `< >`):

| Valore | Esempio |
|---|---|
| Utente amministratore (con `sudo`) | `fraca` |
| Utente di servizio (senza login) | `pallaadue` |
| Sottodominio dell'API | `api.<tuodominio>` |
| Codice dell'app sul server | `/opt/palla-a-due/app` |
| Database SQLite (uno per campionato) | `/var/lib/palla-a-due/<campionato>.db` |
| Variabili d'ambiente | `/etc/palla-a-due/env` |

I valori tra `< >` vanno sostituiti **senza le parentesi** (la shell le interpreta come redirezione: se il tuo utente
è `fraca`, scrivi `fraca`, non `<fraca>`).
I comandi vanno eseguiti sul VPS via SSH. Se un passo cambia l'accesso SSH, **tieni aperta una seconda sessione** finché non
hai verificato che funzioni.

## 0. Login da locale

```bash
ssh root@93.93.118.51
```

## 1. Sistema

```bash
sudo apt update && sudo apt full-upgrade -y
sudo timedatectl set-timezone UTC          # i timer indicano esplicitamente Europe/Rome dove serve
sudo apt install -y curl ca-certificates gnupg git rsync sqlite3 ufw fail2ban unattended-upgrades
```

Ubuntu 26.04 LTS (uscita il 23 aprile 2026): aggiornamenti di sicurezza standard fino ad aprile 2031. Rispetto alle
versioni precedenti ci sono tre novità che i comandi sotto rispettano:

- **`sudo` è ora `sudo-rs`** (riscrittura in Rust): legge gli stessi file sudoers e i comandi di questa guida funzionano,
  ma il prompt della password e alcune opzioni meno comuni sono diversi. Per questo non usiamo `sudo -E` né script
  scaricati e passati a `sudo bash`.
- **Le utility di base (`cp`, `date`, `ls`...) sono `uutils/coreutils`** in Rust, al posto di GNU coreutils. Quelle usate
  qui (`date +%F`, `mkdir`, `chown`...) sono compatibili; `find` e `rsync` non cambiano. Se qualche script si comporta
  in modo diverso, le versioni GNU restano installabili.
- **systemd 259, solo cgroup v2**: i timer e le opzioni di sicurezza delle unità sotto sono supportati.

## 2. Sicurezza di base

**Utente amministratore e chiave SSH** (se non usi già un utente non-root con chiave):

```bash
sudo adduser fraca && sudo usermod -aG sudo fraca
sudo usermod -aG systemd-journal fraca     # permette a fraca di leggere i log (journalctl) senza sudo
# dal tuo Mac: ssh-copy-id fraca@93.93.118.51
```

Il gruppo `systemd-journal` ha effetto dal login successivo: esci e rientra via SSH (`id` deve elencarlo). Senza,
`journalctl -u 'palla-a-due-*'` risponde "You are currently not seeing messages from other users and the system" e
nessuna riga.

**SSH solo con chiave** (dopo aver verificato che l'accesso con chiave funzioni), in `/etc/ssh/sshd_config.d/99-hardening.conf`:

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo sshd -t && sudo systemctl reload ssh
```

**Firewall** (aperte solo SSH, HTTP e HTTPS; la 80 serve a Caddy per ottenere il certificato):

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable && sudo ufw status verbose
```

**Fail2ban e aggiornamenti automatici di sicurezza.** Sulle Ubuntu recenti il log di SSH sta nel journal, non in
`/var/log/auth.log`: si indica esplicitamente il backend `systemd`.

```bash
sudo tee /etc/fail2ban/jail.d/sshd.local >/dev/null <<'EOF'
[sshd]
enabled = true
backend = systemd
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd                    # deve elencare la jail sshd
sudo dpkg-reconfigure -plow unattended-upgrades     # rispondi "Sì"
```

## 3. Node.js 26

Node 26 diventa LTS a fine ottobre 2026 (fino ad allora è "Current"). Alternativa conservativa: sostituisci `26` con
`24` qui sotto. Si usa il repository NodeSource con la procedura manuale (chiave e sorgente apt, senza script passati a
`sudo`):

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_26.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update
apt-cache policy nodejs        # il candidato deve essere 26.x e venire da deb.nodesource.com
sudo apt install -y nodejs
node -v && npm -v
```

Non ho trovato una conferma ufficiale di NodeSource per Ubuntu 26.04 (le guide che ho letto sono miste): se `apt` non
trova il pacchetto, scarica il tarball Linux x64 da nodejs.org (versione 26.x) e decomprimilo in `/usr/local`.

`better-sqlite3` (il driver SQLite) è un modulo nativo. Su Node 26 si installa con il binario precompilato, senza
compilatore; verificato in locale con Node 26.11. Se sul VPS l'installazione dovesse compilare da sorgente,
servono `sudo apt install -y build-essential python3`.

Verifica che funzioni sul VPS:

```bash
mkdir /tmp/sqlite-check && cd /tmp/sqlite-check && npm init -y >/dev/null && npm install better-sqlite3
node -e "const D=require('better-sqlite3');const d=new D(':memory:');d.pragma('journal_mode=WAL');console.log(process.version, d.prepare('select sqlite_version() v').get())"
cd ~ && rm -rf /tmp/sqlite-check
```

## 4. Utente di servizio e cartelle

```bash
sudo adduser --system --group --home /opt/palla-a-due --shell /usr/sbin/nologin pallaadue
sudo mkdir -p /opt/palla-a-due/app /var/lib/palla-a-due /var/backups/palla-a-due /etc/palla-a-due
sudo chown -R pallaadue:pallaadue /opt/palla-a-due /var/lib/palla-a-due /var/backups/palla-a-due
sudo chown -R fraca:fraca /opt/palla-a-due/app          # per il deploy con rsync
sudo chmod 755 /opt/palla-a-due    # adduser --system crea la home con 750: senza questo fraca non raggiunge app/
```

I database stanno in `/var/lib/palla-a-due/`, su disco locale (SQLite non va messo su un filesystem di rete): **un file
per campionato** (`lba.db`, `a2.db`, `b.db`, `euroleague.db`, `eurocup.db`, `nba.db`, `wnba.db`), come nella app, perché gli id di
LBA, LNP ed Euroleague e quelli delle stagioni non devono mescolarsi. Li creano e li migrano i cron alla prima
esecuzione (`migrate.ts` della app); la modalità WAL permette ai cron di scrivere mentre l'API legge, e avere un file
per campionato evita che i timer si contendano la scrittura.

### Variabili d'ambiente

Le variabili d'ambiente sono la configurazione del server (percorso del database, ambiente, URL dei ping di
monitoraggio) tenuta **fuori dal codice e da git**. Stanno in un file di testo, `/etc/palla-a-due/env`, che systemd legge
e passa ai processi (`EnvironmentFile=` nelle unità del passo 6). È solo un elenco `NOME=valore`, una riga per variabile:

- niente `export` e niente spazi attorno al `=`;
- le virgolette non servono (se le metti, diventano parte del valore);
- le righe che iniziano con `#` sono commenti;
- non c'è sostituzione di variabili (`$HOME` non viene espanso).

**1. Crea il file** (come utente amministratore, con `sudo`):

```bash
sudo tee /etc/palla-a-due/env >/dev/null <<'EOF'
NODE_ENV=production
DATABASE_DIR=/var/lib/palla-a-due
EOF
```

Perché `tee`: con `sudo cat > file` la redirezione la esegue la tua shell, senza privilegi, e fallirebbe su `/etc`;
`sudo tee` scrive il file con i privilegi di root. `>/dev/null` evita che `tee` ristampi il contenuto, e `'EOF'` tra
apici impedisce alla shell di espandere ciò che c'è dentro. Incolla tutto il blocco, dal `sudo` fino all'`EOF` finale.

**2. Imposta proprietario e permessi:**

```bash
sudo chown root:pallaadue /etc/palla-a-due/env
sudo chmod 640 /etc/palla-a-due/env
ls -l /etc/palla-a-due/env
```

L'ultima riga deve mostrare `-rw-r----- 1 root pallaadue`. Significa: root può leggere e scrivere, il gruppo
`pallaadue` (l'utente di servizio) può solo leggere, tutti gli altri (compreso il tuo utente) non vedono il file. È
importante perché qui finiranno URL e chiavi che non vanno condivisi.

**3. Controlla che il servizio possa leggerlo:**

```bash
sudo cat /etc/palla-a-due/env                        # contenuto
sudo -u pallaadue cat /etc/palla-a-due/env           # lettura come utente di servizio: deve stampare le stesse righe
```

Se il secondo comando risponde `Permission denied`, rivedi il passo 2.

**4. Aggiungere una variabile in seguito** (per esempio un ping di monitoraggio, passo 10). Con `tee -a` si aggiunge in
coda senza sovrascrivere il file:

```bash
echo 'HEALTHCHECK_URL_LNP_A2=https://hc-ping.com/<uuid>' | sudo tee -a /etc/palla-a-due/env >/dev/null
```

Oppure apri il file in un editor: `sudo nano /etc/palla-a-due/env` (salva con Ctrl+O, esci con Ctrl+X). Sostituisci
`<uuid>` con quello del tuo check, senza le parentesi.

**5. Quando le modifiche hanno effetto.** Ogni cron è un processo che parte, legge il file e termina: la modifica vale
dalla **prossima esecuzione**, senza riavviare nulla. Il servizio dell'API (processo sempre acceso) va invece riavviato:
`sudo systemctl restart palla-a-due-api`.

Variabili previste:

| Variabile | Valore | Obbligatoria |
|---|---|---|
| `NODE_ENV` | `production` | sì |
| `DATABASE_DIR` | `/var/lib/palla-a-due` (cartella dei file `<campionato>.db`) | sì |
| `HEALTHCHECK_URL_<CAMPIONATO>` | URL di ping del check, per esempio `HEALTHCHECK_URL_LNP_A2` | no |

`<CAMPIONATO>` è il codice del campionato in maiuscolo e con il trattino basso: `lnp-a2` → `LNP_A2`, `lnp-b` → `LNP_B`,
`lba` → `LBA`, `euroleague` → `EUROLEAGUE`, `nba` → `NBA`. Se una variabile di ping manca, il cron semplicemente non fa
il ping. A fine sincronizzazione il cron chiama l'URL (o `<URL>/fail` se qualche richiesta è fallita).

Non committare mai questo file e non incollarne il contenuto in chat o in issue: contiene gli URL dei tuoi check.

## 5. Deploy del codice

Il codice dei cron è in `server/` nel repository della app e riusa i file della app con import relativi
(`SyncLeague`, le sorgenti, gli store SQLite), quindi sul VPS si pubblica un bundle già compilato (esbuild, un solo
file `sync.js`), non il repository intero. Il solo codice nuovo è `server/src/`: l'adattatore `better-sqlite3` per
l'interfaccia `Database` della app e `sync.ts` (l'entry point dei cron).

Dal tuo Mac, nella cartella `server/` (richiede la chiave SSH di `fraca` e `sudo` sul VPS):

```bash
cd server
./deploy.sh fraca@93.93.118.51
```

Lo script esegue `npm ci` e `npm run build`, copia `dist/` e `package*.json` in `/opt/palla-a-due/app/` con rsync
(`node_modules` resta sul server), lancia `npm ci --omit=dev` sul VPS (installa `better-sqlite3` per quella macchina),
installa le unità systemd del passo 6 e abilita i timer. È idempotente: si rilancia a ogni modifica del codice.

Prova locale (usa le sorgenti vere e scrive in `server/data/`, ignorata da git):

```bash
cd server && npm ci && npm run sync -- --league lnp-a2
```

`better-sqlite3` resta fuori dal bundle (modulo nativo). Il bundle legge `DATABASE_DIR` e, se esiste,
`HEALTHCHECK_URL_<CAMPIONATO>` dall'ambiente.

## 6. Cron con systemd timers

Un timer per campionato: ogni cron è un processo separato, con il suo log in `journald` e un esito visibile con
`systemctl`. Un campionato che fallisce non ferma gli altri. I file sono in `server/systemd/` e li installa
`deploy.sh`:

- `palla-a-due-sync@.service`: unità modello (`%i` = codice del campionato), esegue `node sync.js --league %i` come
  utente `pallaadue`, con `EnvironmentFile=/etc/palla-a-due/env`, scrittura consentita solo in `/var/lib/palla-a-due`
  (`ProtectSystem=strict`) e `TimeoutStartSec=30min`.
- `palla-a-due-sync@<codice>.timer`: uno per campionato, con `OnCalendar=… Europe/Rome`, `RandomizedDelaySec=120` e
  `Persistent=true`.

Orari consigliati (ora italiana, dopo la fine delle partite del giorno prima):

| Campionato | Codice | Orario | Note |
|---|---|---|---|
| LNP Serie A2 | `lnp-a2` | 07:30 | |
| LNP Serie B (gironi A e B) | `lnp-b` | 07:45 | |
| LBA | `lba` | 08:00 | |
| EuroLeague / EuroCup | `euroleague` | 08:15 | sincronizza prima EuroLeague, poi EuroCup (pausa di 90 s: stesso host) |
| NBA | `nba` | 11:00 | le partite finiscono verso le 6 in Italia |
| WNBA | `wnba` | 11:10 | come la NBA; ESPN, nessuna protezione |

Per installarli a mano (senza `deploy.sh`):

```bash
sudo cp /opt/palla-a-due/app/systemd/palla-a-due-sync@* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now palla-a-due-sync@{lnp-a2,lnp-b,lba,euroleague,nba,wnba}.timer
systemctl list-timers 'palla-a-due-*'                 # prossime esecuzioni
sudo systemctl start palla-a-due-sync@lnp-a2.service   # esecuzione manuale
journalctl -u 'palla-a-due-sync@lnp-a2.service' -n 100 --no-pager
systemctl status palla-a-due-sync@lnp-a2.service       # esito dell'ultima esecuzione
```

`Persistent=true` recupera un'esecuzione saltata se il server era spento all'ora prevista.

**Primo popolamento (backfill)**: all'installazione lancia a mano ogni servizio
(`sudo systemctl start palla-a-due-sync@lba.service`, uno alla volta; `start` attende la fine). Scarica il calendario
della stagione, i box score delle partite concluse e i roster; le esecuzioni successive scaricano solo ciò che manca.
Il backfill di EuroLeague/EuroCup (~100 richieste per campionato su `api-live.euroleague.net`) può prendere un 429
temporaneo: il cron esce con errore e ritenta da dove era arrivato alla prossima esecuzione, oppure rilanciando il
servizio dopo qualche minuto.

**Esito**: il cron esce con codice 1 se qualche richiesta non è riuscita (l'unità risulta `failed` in
`systemctl --failed` e il ping va su `/fail`); i dati già scaricati restano salvati.

## 7. HTTPS senza dominio proprio (hostname di default IONOS + Caddy)

L'app in produzione richiede HTTPS (iOS blocca l'HTTP in chiaro, Android lo blocca di default). Non serve comprare un
dominio per cominciare: IONOS assegna a ogni VPS un hostname che punta già al suo IP, e Caddy ottiene da solo un
certificato Let's Encrypt per quel nome.

| Valore | Questo VPS |
|---|---|
| Hostname di default (pannello IONOS, scheda del VPS, campo "Nome host DNS") | `043q46l.cserverhost.cloud` |
| IPv4 | `93.93.118.51` (nessun IPv6) |

Nel resto della guida `<hostname>` = `043q46l.cserverhost.cloud`, senza le parentesi.

**1. Verifica che l'hostname risolva sull'IP del VPS** (dal Mac o dal VPS; `dig` è nel pacchetto `dnsutils`):

```bash
dig +short <hostname>        # deve stampare 93.93.118.51
```

**2. Apri le porte anche nel firewall IONOS.** Oltre a `ufw` (passo 2) c'è il firewall del pannello IONOS (nel pannello
alla voce "Criteri del firewall", qui `My firewall policy`), che filtra prima che il traffico arrivi al server. Devono
essere consentite in ingresso TCP **22**, **80** e **443**. Senza la 80 (o la 443) Let's Encrypt non riesce a
verificare il dominio e Caddy non ottiene il certificato.

**3. Installa Caddy:**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**4. Prima prova con una risposta fissa** (l'API non esiste ancora, quindi `reverse_proxy` darebbe 502). Sostituisci il
contenuto di `/etc/caddy/Caddyfile`:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
043q46l.cserverhost.cloud {
	respond "ok"
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**5. Controlla certificato e risposta** (la prima richiesta può metterci qualche secondo, il tempo dell'emissione):

```bash
curl -i https://<hostname>              # HTTP/2 200 e corpo "ok", senza errori di certificato
journalctl -u caddy -n 50 --no-pager    # cerca "certificate obtained successfully"
```

Se il certificato non arriva, in ordine: la 80/443 sono aperte sia in `ufw` che nel firewall IONOS? `dig` restituisce
l'IP giusto? Il log di Caddy riporta l'errore di Let's Encrypt (per esempio un rate limit, vedi i limiti sotto).

**6. Quando l'API è pronta**, metti il reverse proxy al posto di `respond` (l'API ascolterà solo su `127.0.0.1:3000`):

```
043q46l.cserverhost.cloud {
	encode zstd gzip
	log {
		output file /var/log/caddy/access.log {
			roll_size 10mb
			roll_keep 5
		}
		format json
	}
	reverse_proxy 127.0.0.1:3000
}
```

L'access log va in un file che Caddy (utente `caddy`) deve poter scrivere. Crealo **prima** del reload:

```bash
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo systemctl reload caddy
```

Se il reload fallisce con `open /var/log/caddy/access.log: permission denied`, il file è stato creato da root (succede con
`sudo caddy validate`): `sudo chown caddy:caddy /var/log/caddy/access.log` e di nuovo il reload. Per validare usa
`sudo -u caddy caddy validate --config /etc/caddy/Caddyfile`. Come leggere il log e ricavarne statistiche:
`docs/server-logs.md`.

Caddy rinnova il certificato da solo (circa ogni 60 giorni, senza intervento). L'API è un secondo servizio systemd
(`palla-a-due-api.service`, `Restart=on-failure`, stesso utente e `EnvironmentFile`), che `deploy.sh` installa e riavvia.
Controlli: `systemctl status palla-a-due-api`, `journalctl -u palla-a-due-api -n 100 --no-pager`,
`curl https://043q46l.cserverhost.cloud/health`. L'URL di base nell'app è `https://043q46l.cserverhost.cloud`
(`EXPO_PUBLIC_API_URL`, vedi `docs/api-backend.md`).

**Limiti di questo hostname:**

- La zona `cserverhost.cloud` è di IONOS: non puoi creare sottodomini né record DNS tuoi, e non puoi usare Cloudflare
  come proxy (il dominio dovrebbe stare nel tuo account Cloudflare).
- L'hostname è legato al VPS: se lo ricrei o lo reinstalli dal pannello, può cambiare, e con lui l'URL scritto nell'app.
- Il dominio è condiviso con molti altri clienti IONOS e Let's Encrypt applica limiti di emissione per dominio: se un
  giorno rifiuta il certificato, passa a un dominio proprio (passo 8).

## 8. Dominio proprio (quando vuoi più controllo)

Con un dominio tuo (circa 10 €/anno) puoi avere un URL stabile e Cloudflare davanti. Crea un record **A**
`api.<tuodominio>` → `93.93.118.51` (senza proxy, se il DNS è su Cloudflare lascia la nuvola grigia, almeno finché
Caddy non ha ottenuto il certificato), verifica con `dig +short api.<tuodominio>` e cambia l'indirizzo del sito nel
`Caddyfile` del passo 7 da `043q46l.cserverhost.cloud` a `api.<tuodominio>`, poi `sudo systemctl reload caddy`. Ricordati
di aggiornare l'URL di base nell'app.

Cloudflare come proxy con cache si può aggiungere dopo mettendo il record DNS in modalità proxy; allora, se vuoi
nascondere l'origine, limita 80/443 agli indirizzi di Cloudflare.

## 9. Backup

SQLite è un singolo file: una copia consistente si fa con il comando `.backup` (sicuro anche con i cron in scrittura),
poi si invia fuori dal VPS. Esempio notturno con `rclone` verso un bucket (R2, B2 o simili):

```bash
sudo apt install -y rclone
rclone config        # crea un remote, per esempio "backup"
```

`/usr/local/bin/palla-a-due-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DAY=$(date +%F)
for DB in /var/lib/palla-a-due/*.db; do
  OUT=/var/backups/palla-a-due/$(basename "$DB" .db)-$DAY.db
  sqlite3 "$DB" ".backup '$OUT'"
  rclone copy "$OUT" backup:palla-a-due/
done
find /var/backups/palla-a-due -name '*.db' -mtime +14 -delete
```

Pianificalo con un timer systemd (come sopra) o con `crontab`. In alternativa **Litestream** replica il file in
continuo su un bucket (utile se non vuoi perdere nemmeno un giorno di dati): installa il `.deb` dall'ultima release
ufficiale e configura `/etc/litestream.yml`. Dato che i cron sono giornalieri e i dati si possono riscaricare dalle
sorgenti, il backup notturno è sufficiente.

**Prova di ripristino**: copia un backup su un'altra macchina e aprilo con `sqlite3 lba-<data>.db "SELECT COUNT(*) FROM matches"`.

## 10. Monitoraggio

- Un servizio di ping (healthchecks.io, piano gratuito): crea un check per campionato con periodo 1 giorno e tolleranza
  di qualche ora; lo script di sincronizzazione chiama l'URL (`HEALTHCHECK_URL_<CAMPIONATO>`) solo a fine lavoro
  riuscito, e ricevi un avviso se un cron salta o fallisce.
- `systemctl --failed` elenca le unità fallite; `journalctl -p err -u 'palla-a-due-*' --since today` i loro errori.
- Traffico e errori dell'API: access log di Caddy, query pronte in `docs/server-logs.md`.
- Dopo l'API: un endpoint che riporta `lastSyncedAt` per campionato (vedi `docs/backend.md`).
- Spazio disco: `df -h /var/lib/palla-a-due` (il database pesa decine di MB per stagione).

## Checklist

- [ ] Sistema aggiornato, fuso orario UTC, pacchetti di base installati
- [ ] Utente `fraca` con chiave SSH; `PermitRootLogin no`, `PasswordAuthentication no`
- [ ] `ufw` attivo (22, 80, 443), `fail2ban` e `unattended-upgrades` attivi
- [ ] Node 26 installato e prova di `better-sqlite3` superata
- [ ] Utente `pallaadue`, cartelle e `/etc/palla-a-due/env` creati
- [ ] `./deploy.sh` eseguito: unità modello `palla-a-due-sync@.service` e un timer per campionato installati
- [ ] Primo popolamento lanciato a mano per ogni campionato
- [ ] Porte 22, 80 e 443 aperte anche nel firewall IONOS; `dig +short 043q46l.cserverhost.cloud` restituisce `93.93.118.51`
- [ ] Caddy installato e `curl https://043q46l.cserverhost.cloud` risponde senza errori di certificato
- [ ] Access log di Caddy attivo (`/var/log/caddy/access.log`, proprietario `caddy`)
- [ ] Backup notturno configurato e ripristino provato
- [ ] Ping di monitoraggio per ogni cron

Quando hai finito i passi 1-4, incollami l'output di `node -v`, `sudo ufw status` e `systemctl --failed` (non ho accesso
al server): posso controllare che sia tutto in ordine prima di scrivere il codice.
