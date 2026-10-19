import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../di/container';
import { SectionTitle } from '../presentation/components/SectionTitle';
import { Empty, ErrorView, Loading } from '../presentation/components/StateViews';
import { TeamLogo } from '../presentation/components/TeamLogo';
import { setFavoriteTeam, useFavoriteTeamId } from '../presentation/hooks/useFavoriteTeam';
import { useAsync } from '../presentation/hooks/useAsync';
import { useDataVersion } from '../presentation/hooks/useSync';
import { colors, fonts, radius } from '../presentation/theme';

export default function SettingsScreen() {
  const dataVersion = useDataVersion();
  const standings = useAsync(() => useCases.getStandings.execute(), [dataVersion]);
  const favoriteId = useFavoriteTeamId();

  const teams = (standings.data ?? []).map((s) => s.team).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <SectionTitle title="SQUADRA PREFERITA" accent={colors.orange} />
      {standings.loading ? (
        <Loading />
      ) : standings.error ? (
        <ErrorView onRetry={standings.reload} />
      ) : teams.length === 0 ? (
        <Empty text="Nessuna squadra disponibile." />
      ) : (
        <View style={styles.list}>
          <TeamOption label="Nessuna" selected={favoriteId === null} onPress={() => setFavoriteTeam(null)} />
          {teams.map((t) => (
            <TeamOption
              key={t.id}
              label={t.name}
              logo={<TeamLogo uri={t.logoUrl} name={t.name} size={32} />}
              selected={favoriteId === t.id}
              onPress={() => setFavoriteTeam(t.id)}
            />
          ))}
        </View>
      )}

      <SectionTitle title="INFO" accent={colors.cyan} />
      <View style={[styles.list, styles.row]}>
        <Text style={styles.label}>Versione</Text>
        <Text style={styles.value}>{Constants.expoConfig?.version ?? '—'}</Text>
      </View>
    </ScrollView>
  );
}

function TeamOption({ label, logo, selected, onPress }: { label: string; logo?: React.ReactNode; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, styles.option, selected && styles.optionSelected]}>
      <View style={styles.logoSlot}>{logo}</View>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.orange} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { marginHorizontal: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { padding: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  optionSelected: { borderColor: colors.orange },
  logoSlot: { width: 32, height: 32 },
  label: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16 },
  value: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 16, marginLeft: 'auto' },
});
