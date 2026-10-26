# Dati WNBA

Fonte unica: le API pubbliche di ESPN, `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/…`, senza chiave né protezioni.
Implementazione: `src/infrastructure/wnba/` (`WnbaLeagueSource`). Il CDN della NBA ha anche i dati della WNBA, ma è dietro Akamai e
risponde 403 ai client che non sembrano un browser (vedi `docs/api-nba.md`): non è usato, quindi **non c'è un backup**.

| Dato | Endpoint | Note |
|---|---|---|
| Calendario e risultati | `scoreboard?dates=AAAAMMGG` | Un giorno per richiesta (ora della costa Est); `dates=AAAA&limit=1000` dà l'anno intero (alcuni MB) e serve solo per trovare prima e ultima partita |
| Box score | `summary?event=<id>` | `boxscore.players[].statistics[0]`: per giocatore minuti, punti, tiri (`33-67`), da 3, liberi, rimbalzi, assist, perse, recuperi, stoppate, falli, +/-. Vuoto prima della palla a due |
| Roster | `teams/<id>/roster` | Ruolo, numero, altezza (pollici), peso (libbre), data e luogo di nascita, allenatore |
| Foto e logo | `a.espncdn.com/i/{teamlogos,headshots}/wnba/…` | Inclusi nell'app (WebP in `assets/images/{teams,players}/wnba/`, generati da `scripts/download-images.mjs` dai roster attuali: 15 logo e le foto disponibili); chi manca o è firmato dopo l'ultimo giro dello script si carica dall'URL. Le chiavi del manifest hanno il suffisso `?wnba` (nel nome del file `@`) per non coincidere con quelle NBA (`atl.png`) |

Id: squadra, giocatore e partita sono gli id di ESPN. Competizione `WNBA`, id `anno * 10 + 1`.

**Le giornate sono le settimane** (lunedì-domenica), contate dal lunedì della prima partita di Regular Season (`weeks.ts`); il numero
totale si ricava dall'ultima. Il calendario dell'anno si scarica una volta e si tiene in memoria un'ora.

## Decisioni e limiti noti

- Solo Regular Season (`season.type` 2, partita `STD`): precampionato, playoff, All-Star Game e finale della Commissioner's Cup
  (`CC`) sono scartati. Rinviate e annullate sono saltate.
- Classifica calcolata dalle partite e ordinata per **percentuale di vittorie**; le prime 8 vanno ai playoff (nessuna conference).
- La valutazione (`rating`) è il PIR della EuroLeague; ESPN non pubblica falli subiti né stoppate subite (0).
- Il box score separa i tiri da 2 sottraendo i tiri da 3 dai tiri dal campo.
- La stagione WNBA (maggio-settembre) coincide con l'anno solare, ma l'app cambia stagione a luglio (`currentSeasonYear`): da gennaio
  a giugno si vede ancora l'anno precedente, e da luglio, finché ESPN non pubblica il calendario, la sincronizzazione segnala
  `Calendario WNBA … non ancora pubblicato`.
- Fuori stagione le partite non cambiano: il calendario si legge una volta (le giornate concluse non si riscaricano).
