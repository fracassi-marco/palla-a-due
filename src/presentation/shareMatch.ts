import { Share } from 'react-native';
import { MatchStatus } from '../domain/entities';
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
    lines.push(`${m.homeName} vs ${m.awayName}`, `${when} · ore ${formatTime(m.startsAt)}`);
  } else {
    lines.push(`${m.homeName} ${m.homeScore}-${m.awayScore} ${m.awayName}`, m.status === 'live' ? `🔴 LIVE · ${when}` : `Finale · ${when}`);
  }
  lines.push('', 'via Palla a Due');
  return lines.join('\n');
}

export const shareMatch = (m: ShareableMatch) => Share.share({ message: matchShareText(m) });
