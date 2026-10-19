import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCases } from '../di/container';
import { MatchCard } from '../presentation/components/MatchCard';
import { SectionTitle } from '../presentation/components/SectionTitle';
import { Empty, ErrorView, Loading } from '../presentation/components/StateViews';
import { StandingsTable } from '../presentation/components/StandingsTable';
import { useOpenMatch } from '../presentation/hooks/useOpenMatch';
import { useAsync } from '../presentation/hooks/useAsync';
import { colors, fonts, radius } from '../presentation/theme';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.82, 340);

  const standings = useAsync(() => useCases.getStandings.execute());
  const matches = useAsync(() => useCases.getCurrentRound.execute());

  const refreshing = standings.refreshing || matches.refreshing;
  const reloadAll = () => {
    standings.reload();
    matches.reload();
  };

  const openMatch = useOpenMatch();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.orange} />}
      >
        <LinearGradient colors={[colors.orangeDeep, colors.orange, colors.yellow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Ionicons name="basketball" size={120} color="rgba(11,16,32,0.14)" style={styles.heroBall} />
          <Text style={styles.heroKicker}>LEGA BASKET SERIE A</Text>
          <Text style={styles.heroTitle}>TUTTO{'\n'}BASKET</Text>
        </LinearGradient>

        <SectionTitle title="PARTITE" accent={colors.cyan} right={matches.data?.[0]?.dayName.toUpperCase()} />
        {matches.loading ? (
          <Loading />
        ) : matches.error ? (
          <ErrorView onRetry={matches.reload} />
        ) : matches.data && matches.data.length > 0 ? (
          <FlatList
            horizontal
            data={matches.data}
            keyExtractor={(m) => String(m.id)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => <MatchCard match={item} width={cardWidth} onPress={() => openMatch(item)} />}
          />
        ) : (
          <Empty text="Nessuna partita in programma." />
        )}
        <Link href="/calendar" asChild>
          <Pressable style={styles.calendarBtn}>
            <Ionicons name="calendar-outline" size={18} color={colors.cyan} />
            <Text style={styles.calendarText}>TUTTO IL CALENDARIO</Text>
          </Pressable>
        </Link>

        <SectionTitle title="CLASSIFICA" accent={colors.orange} right="REGULAR SEASON" />
        {standings.loading ? (
          <Loading />
        ) : standings.error ? (
          <ErrorView onRetry={standings.reload} />
        ) : standings.data && standings.data.length > 0 ? (
          <>
            <StandingsTable standings={standings.data} />
            <View style={styles.legend}>
              <LegendDot color={colors.green} label="Playoff" />
              <LegendDot color={colors.orange} label="Zona playoff" />
              <LegendDot color={colors.red} label="Retrocessione" />
            </View>
          </>
        ) : (
          <Empty text="Classifica non ancora disponibile." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 28, padding: 22, overflow: 'hidden', minHeight: 150, justifyContent: 'flex-end' },
  heroBall: { position: 'absolute', right: -14, top: -14 },
  heroKicker: { color: colors.bg, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 2.5 },
  heroTitle: { color: colors.bg, fontFamily: fonts.display, fontSize: 62, lineHeight: 58, letterSpacing: 1, transform: [{ skewX: '-6deg' }] },
  calendarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  calendarText: { color: colors.cyan, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
