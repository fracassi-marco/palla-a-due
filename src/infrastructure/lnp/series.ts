/** Un girone (o l'unico campionato) nei dati LNP: `key` è la "league" usata dalle loro API. */
export interface LnpGroup {
  key: string;
  /** Cifra (1-9) che distingue i gironi dentro gli id numerici dell'app. */
  code: number;
  name: string;
}

export interface LnpSeries {
  /** Pagina con l'elenco delle squadre e i link alle loro schede. */
  teamsPage: string;
  groups: LnpGroup[];
}

export const LNP_A2: LnpSeries = {
  teamsPage: '/serie/1/squadre',
  groups: [{ key: 'ita2', code: 1, name: 'Serie A2' }],
};

export const LNP_B: LnpSeries = {
  teamsPage: '/serie/4/squadre',
  groups: [
    { key: 'ita3_a', code: 2, name: 'Girone A' },
    { key: 'ita3_b', code: 3, name: 'Girone B' },
  ],
};
