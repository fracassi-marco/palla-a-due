import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { t } from '../../i18n';
import { PlayerRow } from '../../presentation/components/PlayerRow';
import { SectionTitle } from '../../presentation/components/SectionTitle';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { TeamLogo } from '../../presentation/components/TeamLogo';
import { TeamStatsSection } from '../../presentation/components/TeamStatsSection';
import { useAsync } from '../../presentation/hooks/useAsync';
import { useDataVersion } from '../../presentation/hooks/useSync';
import { colors, fonts, radius } from '../../presentation/theme';

type Params = Record<'id' | 'name' | 'logo', string>;

export default function TeamScreen() {
  const p = useLocalSearchParams<Params>();
  const router = useRouter();
  const teamId = Number(p.id);
  const dataVersion = useDataVersion();
  const roster = useAsync(() => useCases.getTeamRoster.execute(teamId), [teamId, dataVersion]);
  const stats = useAsync(() => useCases.getTeamStats.execute(teamId), [teamId, dataVersion]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TeamLogo uri={p.logo || null} name={p.name} size={88} />
        <Text style={styles.name}>{p.name}</Text>
      </View>
      {stats.data ? <TeamStatsSection stats={stats.data} /> : null}
      <SectionTitle title={t('roster.title')} accent={colors.cyan} />
      {roster.loading ? (
        <Loading label={t('roster.loading')} />
      ) : roster.error ? (
        <ErrorView onRetry={roster.reload} />
      ) : roster.data && roster.data.players.length > 0 ? (
        <View>
          {roster.data.coach ? (
            <View style={styles.coach}>
              <Text style={styles.coachLabel}>{t('roster.headCoach')}</Text>
              <Text style={styles.coachName}>{roster.data.coach.firstName} {roster.data.coach.lastName}</Text>
            </View>
          ) : null}
          {roster.data.players.map((pl) => (
            <PlayerRow key={pl.id} player={pl} onPress={() => router.push({ pathname: '/player/[id]', params: { id: String(pl.id) } })} />
          ))}
        </View>
      ) : (
        <Empty text={t('roster.unavailable')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, margin: 16, padding: 18, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.orange },
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 30, textAlign: 'center' },
  coach: { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  coachLabel: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.5 },
  coachName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15 },
});
