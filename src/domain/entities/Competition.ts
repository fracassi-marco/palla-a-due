export interface Competition {
  id: number;
  name: string;
  year: number;
  /** Numero di giornate, se la fonte lo conosce già: altrimenti lo deduce la sincronizzazione dal girone all'italiana. */
  totalDays?: number | null;
  /** `playoff` per la competizione che raccoglie le gare di playoff della stagione; assente = Regular Season. */
  phase?: 'regular' | 'playoff';
}
