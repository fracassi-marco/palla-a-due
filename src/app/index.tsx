import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { RankedStat } from '../domain/entities';
import { leagueInfo } from '../domain/League';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCases } from '../di/container';
import { LeagueSelector } from '../presentation/components/LeagueSelector';
import { MatchCard } from '../presentation/components/MatchCard';
import { SectionTitle } from '../presentation/components/SectionTitle';
import { Empty, ErrorView, Loading } from '../presentation/components/StateViews';
import { StandingsTable } from '../presentation/components/StandingsTable';
import { RANKING_STATS } from '../presentation/rankingStats';
import { useOpenMatch } from '../presentation/hooks/useOpenMatch';
import { favoriteFirst } from '../domain/favoriteFirst';
import { useFavoriteTeamId } from '../presentation/hooks/useFavoriteTeam';
import { useLeague } from '../presentation/hooks/useLeague';
import { useAsync } from '../presentation/hooks/useAsync';
import { useDataVersion } from '../presentation/hooks/useSync';
import { colors, fonts, radius } from '../presentation/theme';

const HOME_STATS = Object.keys(RANKING_STATS) as RankedStat[];

const STAT_ICONS: Record<RankedStat, keyof typeof Ionicons.glyphMap> = {
  points: 'basketball',
  totalRebounds: 'arrow-up-circle',
  assists: 'git-network',
  rating: 'star',
  minutes: 'time',
  steals: 'flash',
  blocks: 'hand-left',
  turnovers: 'alert-circle',
  twoPercent: 'locate',
  threePercent: 'radio-button-on',
  freeThrowPercent: 'disc',
};

/** Cambiando campionato la schermata riparte da zero, senza mostrare per un attimo i dati del precedente. */
export default function HomeScreen() {
  return <Home key={useLeague()} />;
}

function Home() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.82, 340);

  const leagueId = useLeague();
  const league = leagueInfo(leagueId);
  const dataVersion = useDataVersion();
  const standings = useAsync(() => useCases.getStandings.execute(), [dataVersion], `${leagueId}:standings`);
  const matches = useAsync(() => useCases.getCurrentRound.execute(), [dataVersion], `${leagueId}:round`);

  const refreshing = standings.refreshing || matches.refreshing;
  const reloadAll = () => {
    standings.reload();
    matches.reload();
    void useCases.sync.start();
  };

  const openMatch = useOpenMatch();
  const favoriteId = useFavoriteTeamId();
  const roundMatches = useMemo(() => favoriteFirst(matches.data ?? [], favoriteId), [matches.data, favoriteId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.orange} />}
      >
        <LinearGradient colors={[colors.orangeDeep, colors.orange, colors.yellow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Ionicons name="basketball" size={84} color="rgba(11,16,32,0.14)" style={styles.heroBall} />
          <Text style={styles.heroKicker}>{league.title}</Text>
          <Text style={styles.heroTitle}>PALLA A DUE</Text>
          <Link href="/settings" asChild>
            <Pressable hitSlop={12} style={styles.settingsBtn} accessibilityLabel="Impostazioni">
              <Ionicons name="settings-outline" size={22} color={colors.bg} />
            </Pressable>
          </Link>
        </LinearGradient>

        <LeagueSelector />

        <SectionTitle title="PARTITE" accent={colors.cyan} right={matches.data?.[0]?.dayName.toUpperCase()} />
        {matches.loading ? (
          <Loading />
        ) : matches.error ? (
          <ErrorView onRetry={matches.reload} />
        ) : roundMatches.length > 0 ? (
          <FlatList
            horizontal
            data={roundMatches}
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
        ) : standings.data && standings.data.some((g) => g.standings.length > 0) ? (
          <>
            {standings.data.map((group) => (
              <View key={group.competitionId} style={styles.group}>
                {standings.data!.length > 1 ? <Text style={styles.groupTitle}>{group.name.toUpperCase()}</Text> : null}
                <StandingsTable standings={group.standings} />
              </View>
            ))}
            {league.playoffSpots > 0 ? (
              <View style={styles.legend}>
                <LegendDot color={colors.green} label="Playoff" />
                <LegendDot color={colors.orange} label="Zona playoff" />
                {league.relegationSpots > 0 ? <LegendDot color={colors.red} label="Retrocessione" /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Empty text="Classifica non ancora disponibile." />
        )}
        <SectionTitle title="STATISTICHE GIOCATORI" accent={colors.yellow} right="LEADER DI LEGA" />
        <View style={styles.statGrid}>
          {HOME_STATS.map((stat) => (
            <Link key={stat} href={{ pathname: '/ranking/[stat]', params: { stat } }} asChild>
              <Pressable style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name={STAT_ICONS[stat]} size={20} color={colors.orange} />
                </View>
                <Text style={styles.statTitle} numberOfLines={1}>{RANKING_STATS[stat].title}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </Link>
          ))}
        </View>
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
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 22, padding: 16, overflow: 'hidden', minHeight: 96, justifyContent: 'flex-end' },
  settingsBtn: { position: 'absolute', right: 14, bottom: 14 },
  heroBall: { position: 'absolute', right: -8, top: -10 },
  heroKicker: { color: colors.bg, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 2.5 },
  heroTitle: { color: colors.bg, fontFamily: fonts.display, fontSize: 42, lineHeight: 46, letterSpacing: 1, transform: [{ skewX: '-6deg' }] },
  calendarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  calendarText: { color: colors.cyan, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  statGrid: { gap: 12, paddingHorizontal: 16 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  statTitle: { flex: 1, flexShrink: 1, color: colors.text, fontFamily: fonts.condensed, fontSize: 16, letterSpacing: 0.8 },
  group: { gap: 8, marginBottom: 12 },
  groupTitle: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 16, letterSpacing: 1.5, marginHorizontal: 16 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
