import { RankedStat } from '../domain/entities';
import { t } from '../i18n';

const perGame = t('ranking.perGame');
const percentage = t('ranking.percentage');

export const RANKING_STATS: Record<RankedStat, { title: string; unit: string; percent?: boolean }> = {
  points: { title: t('ranking.points'), unit: perGame },
  totalRebounds: { title: t('ranking.totalRebounds'), unit: perGame },
  assists: { title: t('ranking.assists'), unit: perGame },
  rating: { title: t('ranking.rating'), unit: perGame },
  minutes: { title: t('ranking.minutes'), unit: perGame },
  steals: { title: t('ranking.steals'), unit: perGame },
  blocks: { title: t('ranking.blocks'), unit: perGame },
  turnovers: { title: t('ranking.turnovers'), unit: perGame },
  twoPercent: { title: t('ranking.twoPercent'), unit: percentage, percent: true },
  threePercent: { title: t('ranking.threePercent'), unit: percentage, percent: true },
  freeThrowPercent: { title: t('ranking.freeThrowPercent'), unit: percentage, percent: true },
};
