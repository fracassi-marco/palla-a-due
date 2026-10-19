/** L'API LBA identifica la stagione con l'anno di inizio: da luglio in poi è la nuova stagione. */
export function currentSeasonYear(now: Date = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}
