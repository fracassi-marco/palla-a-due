import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../di/container';
import { MatchCard } from '../presentation/components/MatchCard';
import { Empty, ErrorView, Loading } from '../presentation/components/StateViews';
import { useAsync } from '../presentation/hooks/useAsync';
import { useDataVersion } from '../presentation/hooks/useSync';
import { favoriteFirst } from '../domain/favoriteFirst';
import { useFavoriteTeamId } from '../presentation/hooks/useFavoriteTeam';
import { useOpenMatch } from '../presentation/hooks/useOpenMatch';
import { colors, fonts, radius } from '../presentation/theme';

const CHIP_WIDTH = 64;

function DayMatches({ competitionId, day }: { competitionId: number; day: number }) {
  const openMatch = useOpenMatch();
  const dataVersion = useDataVersion();
  const matches = useAsync(() => useCases.getCalendar.day(competitionId, day), [competitionId, day, dataVersion]);

  const favoriteId = useFavoriteTeamId();
  const ordered = useMemo(() => favoriteFirst(matches.data ?? [], favoriteId), [matches.data, favoriteId]);

  if (matches.loading) return <Loading />;
  if (matches.error) return <ErrorView onRetry={matches.reload} />;
  return (
    <FlatList
      data={ordered}
      keyExtractor={(m) => String(m.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={matches.refreshing} onRefresh={matches.reload} tintColor={colors.orange} />}
      ListHeaderComponent={
        matches.data?.[0] ? <Text style={styles.dayTitle}>{matches.data[0].dayName.toUpperCase()}</Text> : undefined
      }
      ListEmptyComponent={<Empty text="Nessuna partita in questa giornata." />}
      renderItem={({ item }) => <MatchCard match={item} onPress={() => openMatch(item)} />}
    />
  );
}

export default function CalendarScreen() {
  const dataVersion = useDataVersion();
  const overview = useAsync(() => useCases.getCalendar.overview(), [dataVersion]);
  const [selected, setSelected] = useState<number | null>(null);
  const chips = useRef<FlatList<number>>(null);

  const competitionId = overview.data?.competitionId;
  const day = selected ?? overview.data?.initialDay ?? null;

  useEffect(() => {
    if (!overview.data || !day) return;
    chips.current?.scrollToIndex({ index: day - 1, viewPosition: 0.5, animated: true });
  }, [overview.data, day]);

  if (overview.loading) return <Loading />;
  if (overview.error || !overview.data) return <ErrorView onRetry={overview.reload} />;

  const days = Array.from({ length: overview.data.totalDays }, (_, i) => i + 1);

  return (
    <View style={styles.root}>
      <FlatList
        ref={chips}
        horizontal
        data={days}
        keyExtractor={(d) => String(d)}
        showsHorizontalScrollIndicator={false}
        style={styles.chipList}
        contentContainerStyle={styles.chips}
        getItemLayout={(_, index) => ({ length: CHIP_WIDTH + 8, offset: (CHIP_WIDTH + 8) * index, index })}
        renderItem={({ item }) => {
          const active = item === day;
          const current = item === overview.data!.initialDay;
          return (
            <Pressable onPress={() => setSelected(item)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>G{item}</Text>
              {current ? <View style={[styles.currentDot, active && { backgroundColor: colors.bg }]} /> : null}
            </Pressable>
          );
        }}
      />

      {competitionId && day ? <DayMatches key={day} competitionId={competitionId} day={day} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chipList: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { width: CHIP_WIDTH, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 22, letterSpacing: 1 },
  chipTextActive: { color: colors.bg },
  currentDot: { position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.cyan },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  dayTitle: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 16, letterSpacing: 1.5, marginBottom: 4 },
});
