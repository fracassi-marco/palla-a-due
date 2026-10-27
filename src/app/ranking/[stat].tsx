import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { LeagueRankingEntry } from '../../domain/entities';
import { isRankedStat } from '../../domain/statLines';
import { resolveImageSource } from '../../infrastructure/images';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { useFavoriteTeamId } from '../../presentation/hooks/useFavoriteTeam';
import { useAsync } from '../../presentation/hooks/useAsync';
import { RANKING_STATS as STATS } from '../../presentation/rankingStats';
import { useStatsVersion } from '../../presentation/hooks/useSync';
import { colors, fonts, radius } from '../../presentation/theme';
import { one } from '../../presentation/theme/format';

/** "Guardia/Ala" → ["Guardia", "Ala"]. */
const rolesOf = (role: string) => role.split('/').map((r) => r.trim()).filter(Boolean);

const ROW_HEIGHT = 64;
const ROW_GAP = 8;

export default function RankingScreen() {
  const params = useLocalSearchParams<{ stat: string; player?: string }>();
  const router = useRouter();
  const statsVersion = useStatsVersion();
  const stat = isRankedStat(params.stat) ? params.stat : null;
  const highlightId = params.player ? Number(params.player) : null;
  const favoriteId = useFavoriteTeamId();
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const ranking = useAsync(
    () => (stat ? useCases.getLeagueRanking.execute(stat) : Promise.resolve([])),
    [stat, statsVersion],
  );

  if (!stat) return <Empty text="Statistica sconosciuta." />;
  if (ranking.loading) return <Loading label="Calcolo la classifica…" />;
  if (ranking.error || !ranking.data) return <ErrorView onRetry={ranking.reload} />;

  const { title, unit, percent } = STATS[stat];
  // Con il filtro le posizioni restano quelle della lega.
  const filtering = onlyFavorite && favoriteId !== null;
  // I chip sono i ruoli che compaiono davvero in questa classifica, i più numerosi per primi.
  const roleCounts = new Map<string, number>();
  for (const e of ranking.data) for (const r of rolesOf(e.player.role)) roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  const roles = [...roleCounts.keys()].sort((x, y) => roleCounts.get(y)! - roleCounts.get(x)!);
  const entries = ranking.data.filter(
    (e) => (!filtering || e.player.teamId === favoriteId) && (!role || rolesOf(e.player.role).includes(role)),
  );
  const highlightIndex = entries.findIndex((e) => e.player.id === highlightId);

  return (
    <View style={styles.root}>
    {roles.length > 1 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rolesScroll} contentContainerStyle={styles.roles}>
        {roles.map((r) => (
          <Pressable key={r} onPress={() => setRole(role === r ? null : r)} style={[styles.chip, role === r && styles.chipActive]}>
            <Text style={[styles.chipLabel, role === r && styles.chipLabelActive]}>{r.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>
    ) : null}
    {favoriteId !== null ? (
      <View style={styles.filter}>
        <Text style={styles.filterLabel}>SOLO LA MIA SQUADRA</Text>
        <Switch
          value={onlyFavorite}
          onValueChange={setOnlyFavorite}
          trackColor={{ false: colors.border, true: colors.orange }}
          thumbColor={colors.text}
        />
      </View>
    ) : null}
    <FlatList
      data={entries}
      keyExtractor={(e) => String(e.player.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.unit}>{unit} · {entries.length} GIOCATORI</Text>
        </View>
      }
      ListEmptyComponent={<Empty text="Ancora nessun giocatore classificato." />}
      renderItem={({ item }) => (
        <Row
          entry={item}
          percent={percent}
          highlighted={item.player.id === highlightId}
          onPress={() => router.push({ pathname: '/player/[id]', params: { id: String(item.player.id) } })}
        />
      )}
      // Le righe hanno altezza fissa: si può aprire la classifica già centrata sul giocatore.
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT + ROW_GAP, offset: HEADER_HEIGHT + index * (ROW_HEIGHT + ROW_GAP), index })}
      initialScrollIndex={highlightIndex > 2 ? highlightIndex - 2 : undefined}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
    </View>
  );
}

const HEADER_HEIGHT = 72;

function Row({ entry, percent, highlighted, onPress }: { entry: LeagueRankingEntry; percent?: boolean; highlighted: boolean; onPress: () => void }) {
  const { player, position, value } = entry;
  return (
    <Pressable onPress={onPress} style={[styles.row, highlighted && styles.highlighted]}>
      <Text style={[styles.position, position <= 3 && styles.podium]}>{position}</Text>
      <View style={styles.photoWrap}>
        {player.photoUrl ? (
          <Image source={resolveImageSource(player.photoUrl)} style={styles.photo} contentFit="cover" contentPosition="top" />
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{player.firstName} {player.lastName.toUpperCase()}</Text>
        <Text style={styles.team} numberOfLines={1}>{player.teamName}</Text>
      </View>
      <Text style={styles.value}>{percent ? `${(value * 100).toFixed(1)}%` : one(value)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  filterLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.2 },
  rolesScroll: { flexGrow: 0 },
  roles: { gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  chip: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.2 },
  chipLabelActive: { color: colors.bg },
  header: { height: HEADER_HEIGHT, paddingHorizontal: 16, justifyContent: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32 },
  unit: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1.2 },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: ROW_GAP, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  highlighted: { borderColor: colors.orange, borderWidth: 2 },
  position: { width: 34, color: colors.textMuted, fontFamily: fonts.display, fontSize: 24, textAlign: 'center' },
  podium: { color: colors.yellow },
  photoWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  info: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 },
  team: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  value: { color: colors.orange, fontFamily: fonts.display, fontSize: 28 },
});
