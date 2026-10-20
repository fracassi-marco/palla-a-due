/** Una partita nel calendario di `lnpstat.domino.it` (tutti i valori numerici arrivano come stringhe). */
export interface ScheduleGameDto {
  gameid: string;
  teamid_home: string;
  teamname_home: string;
  score_home: string | null;
  teamid_away: string;
  teamname_away: string;
  score_away: string | null;
  round: string;
  /** gg/mm/aaaa, ora italiana. */
  date: string | null;
  /** hh:mm, ora italiana. */
  time: string | null;
  arena: string | null;
  stream_url: string | null;
  /** "finished" a partita conclusa, "ready" prima della palla a due. */
  game_status: string;
}
