# Dati della Lega Nazionale Pallacanestro (Serie A2 e B Nazionale)

`www.legapallacanestro.com` è un sito Drupal: **non** ha API REST come `/api/matches` o `/api/standings` (rispondono con
la homepage HTML). Le tabelle del sito sono riempite da un endpoint JSON su un altro dominio; box score e roster esistono
solo come pagine HTML. Implementazione: `src/infrastructure/lnp/` (`LnpLeagueSource`).

Stagione nel formato LNP: `x` + anni a 2 cifre (2026/27 → `x2627`). Campionati (`league`): `ita2` (Serie A2),
`ita3_a` e `ita3_b` (Serie B Nazionale, gironi A e B). Pagine: `/serie/1/…` = A2, `/serie/4/…` = B.

| Dato | Fonte | Note |
|---|---|---|
| Calendario e risultati | `GET https://lnpstat.domino.it/getstatisticsfiles?task=schedule&year=x2627&league=ita2&round=<n>` | JSON; `game_status` è `finished` o `ready` (altri valori sono trattati come live: non osservati). Data e ora italiane. Giornata inesistente → oggetto `error` o 404 |
| Classifica ufficiale | `…?task=standings&year=x2627&league=ita2&round=ista` | JSON con punti ufficiali; **non usata** (la classifica è calcolata dal database, come per la LBA) |
| Box score | `GET /wp/match/<gameid>/<league>/<season>` (es. `/wp/match/ita2_403/ita2/x2627`) | HTML, due blocchi `table-left`/`table-right` (casa, ospiti); parser in `parsers.ts`. Niente +/- (resta 0) |
| Elenco squadre | `/serie/1/squadre`, `/serie/4/squadre` | Percorso della scheda e estensione del logo (`.png` o `.jpg`, cambia per squadra) |
| Roster e allenatore | scheda squadra, es. `/serie-a2/ueb-gesteco-cividale` | HTML. Le foto del roster hanno un id diverso da quello delle statistiche: gli id giocatore si leggono dai link `/giocatore/wp/<id>` della stessa pagina, incrociando i nomi |
| Loghi | `/sites/default/files/styles/255_x/public/team_logo/<teamid>.<ext>` | |

`lnp.webpont.com/team/images/player/<season>/<id>.jpg` ospita le foto dei giocatori. I dati live di Genius Sports
(`fibalivestats…/data/<id>/data.json`) non sono usati.

## Id numerici

Il database vuole interi unici, LNP usa testo e ripete gli id ogni stagione (`lnp/ids.ts`):
competizione = `anno(2 cifre) * 10 + cifra del girone`; partita = `competizione * 100000 + numero di gara`
(`ita2_403` nel 2026 → `26100403`), decodificabile per scaricare il box score; giocatore `A59109` → `59109`
(gli id non numerici diventano un hash stabile). Gli id squadra sono quelli LNP.

## Limiti noti

- La classifica è calcolata dalle partite: le penalizzazioni di punti (es. −2 a una squadra di A2) non compaiono.
- Le sigle delle squadre (`code`) non esistono in LNP: derivate dal nome.
- Il nome/cognome dei giocatori nei box score è dedotto ("Nome Cognome", prima parola = nome) finché non si scarica il
  roster, che poi lo corregge.
- Play-off, fase "ad orologio" della A2 e coppe non sono gestiti: solo la Regular Season.
