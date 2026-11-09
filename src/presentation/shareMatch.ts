import { Share } from 'react-native';
import { MatchStatus } from '../domain/entities';
import { t } from '../i18n';
import { formatDayMonth, formatTime, formatWeekday } from './theme/format';

interface ShareableMatch {
  homeName: string;
  awayName: string;
  homeScore: number | string;
  awayScore: number | string;
  status: MatchStatus;
  startsAt: Date;
}

export function matchShareText(m: ShareableMatch): string {
  const when = `${formatWeekday(m.startsAt)} ${formatDayMonth(m.startsAt)}`;
  const lines = ['🏀 LEGA BASKET SERIE A'];
  if (m.status === 'scheduled') {
    lines.push(`${m.homeName} vs ${m.awayName}`, `${when} · ${t('share.at', { time: formatTime(m.startsAt) })}`);
  } else {
    lines.push(`${m.homeName} ${m.homeScore}-${m.awayScore} ${m.awayName}`, m.status === 'live' ? `🔴 ${t('match.live')} · ${when}` : `${t('share.final')} · ${when}`);
  }
  lines.push('', t('share.via'));
  return lines.join('\n');
}

export const shareMatch = (m: ShareableMatch) => Share.share({ message: matchShareText(m) });
