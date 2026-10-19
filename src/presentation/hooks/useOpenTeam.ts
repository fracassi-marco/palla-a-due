import { useRouter } from 'expo-router';

export function useOpenTeam() {
  const router = useRouter();
  return (id: number, name: string, logoUrl: string | null) =>
    router.push({ pathname: '/team/[id]', params: { id: String(id), name, logo: logoUrl ?? '' } });
}
