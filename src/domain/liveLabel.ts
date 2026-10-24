const REGULATION_PERIODS = 4;

/**
 * Etichetta del tempo di gioco: "Q2 5:32"; col clock a zero il periodo è finito ("Fine Q1", "Intervallo").
 * Senza clock (`remainingSeconds` null) resta solo il periodo. Null se la partita non è ancora in un periodo.
 */
export function liveLabel(period: number, remainingSeconds: number | null): string | null {
  if (!Number.isFinite(period) || period < 1) return null;
  const name = period <= REGULATION_PERIODS ? `Q${period}` : `OT${period - REGULATION_PERIODS}`;
  if (remainingSeconds === null) return name;
  const seconds = Math.floor(remainingSeconds);
  if (seconds <= 0) return period === REGULATION_PERIODS / 2 ? 'Intervallo' : `Fine ${name}`;
  return `${name} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
