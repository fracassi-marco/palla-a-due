import { RankedStat } from '../domain/entities';

export const RANKING_STATS: Record<RankedStat, { title: string; unit: string; percent?: boolean }> = {
  points: { title: 'PUNTI', unit: 'A PARTITA' },
  totalRebounds: { title: 'RIMBALZI', unit: 'A PARTITA' },
  assists: { title: 'ASSIST', unit: 'A PARTITA' },
  rating: { title: 'VALUTAZIONE', unit: 'A PARTITA' },
  minutes: { title: 'MINUTI', unit: 'A PARTITA' },
  steals: { title: 'PALLE RUBATE', unit: 'A PARTITA' },
  blocks: { title: 'STOPPATE', unit: 'A PARTITA' },
  turnovers: { title: 'PALLE PERSE', unit: 'A PARTITA, MENO È MEGLIO' },
  twoPercent: { title: 'TIRI DA 2', unit: 'PERCENTUALE, ALMENO 1 TIRO A PARTITA', percent: true },
  threePercent: { title: 'TIRI DA 3', unit: 'PERCENTUALE, ALMENO 1 TIRO A PARTITA', percent: true },
  freeThrowPercent: { title: 'TIRI LIBERI', unit: 'PERCENTUALE, ALMENO 1 TIRO A PARTITA', percent: true },
};
