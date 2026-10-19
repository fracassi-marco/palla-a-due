import { useRouter } from 'expo-router';
import { Match } from '../../domain/entities';

export function useOpenMatch() {
  const router = useRouter();
  return (m: Match) =>
    router.push({
      pathname: '/match/[id]',
      params: {
        id: String(m.id),
        homeId: String(m.home.id),
        awayId: String(m.away.id),
        homeName: m.home.name,
        awayName: m.away.name,
        homeLogo: m.home.logoUrl ?? '',
        awayLogo: m.away.logoUrl ?? '',
        startsAt: m.startsAt.toISOString(),
        status: m.status,
        homeScore: String(m.homeScore ?? ''),
        awayScore: String(m.awayScore ?? ''),
      },
    });
}
