/** Una coppa dell'API ufficiale di Euroleague Basketball: `code` è la "competition" usata dai loro URL. */
export interface EuroleagueSeries {
  code: 'E' | 'U';
  /** Nome della competizione quando ha un solo girone. */
  name: string;
}

export const EUROLEAGUE: EuroleagueSeries = { code: 'E', name: 'EuroLeague' };
export const EUROCUP: EuroleagueSeries = { code: 'U', name: 'EuroCup' };
