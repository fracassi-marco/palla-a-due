import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { LeagueRankingEntry, RankedStat } from '../../domain/entities';
import { isRankedStat } from '../../domain/statLines';
import { resolveImageSource } from '../../infrastructure/images';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { useAsync } from '../../presentation/hooks/useAsync';
import { useDataVersion } from '../../presentation/hooks/useSync';
import { colors, fonts, radius } from '../../presentation/theme';
import { one } from '../../presentation/theme/format';

const ROW_HEIGHT = 64;
const ROW_GAP = 8;

const STATS: Record<RankedStat, { title: string; unit: string; percent?: boolean }> = {
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

export default function RankingScreen() {
  const params = useLocalSearchParams<{ stat: string; player?: string }>();
  const router = useRouter();
  const dataVersion = useDataVersion();
  const stat = isRankedStat(params.stat) ? params.stat : null;
  const highlightId = params.player ? Number(params.player) : null;
  const ranking = useAsync(
    () => (stat ? useCases.getLeagueRanking.execute(stat) : Promise.resolve([])),
    [stat, dataVersion],
  );

  if (!stat) return <Empty text="Statistica sconosciuta." />;
  if (ranking.loading) return <Loading label="Calcolo la classifica…" />;
  if (ranking.error || !ranking.data) return <ErrorView onRetry={ranking.reload} />;

  const { title, unit, percent } = STATS[stat];
  const entries = ranking.data;
  const highlightIndex = entries.findIndex((e) => e.player.id === highlightId);

  return (
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
