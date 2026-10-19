import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { Roster, StatLine } from '../../domain/entities';
import { PlayerRow } from '../../presentation/components/PlayerRow';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { TeamLogo } from '../../presentation/components/TeamLogo';
import { useOpenTeam } from '../../presentation/hooks/useOpenTeam';
import { useAsync } from '../../presentation/hooks/useAsync';
import { colors, fonts, radius } from '../../presentation/theme';
import { formatDayMonth, formatTime, formatWeekday } from '../../presentation/theme/format';

type Params = Record<'id' | 'homeId' | 'awayId' | 'homeName' | 'awayName' | 'homeLogo' | 'awayLogo' | 'startsAt' | 'status' | 'homeScore' | 'awayScore', string>;

export default function MatchScreen() {
  const p = useLocalSearchParams<Params>();
  const router = useRouter();
  const openTeam = useOpenTeam();
  const [side, setSide] = useState<'home' | 'away'>('home');

  const teamId = Number(side === 'home' ? p.homeId : p.awayId);
  const roster = useAsync(() => useCases.getTeamRoster.execute(teamId), [teamId]);

  const startsAt = new Date(p.startsAt);
  const played = p.status !== 'scheduled';
  const live = p.status === 'live';

  const boxScore = useAsync(
    () => (played ? useCases.getMatchBoxScore.execute(Number(p.id)) : Promise.resolve(null)),
    [p.id, played],
  );
  const reloadBoxScore = boxScore.reload;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(reloadBoxScore, 30_000);
    return () => clearInterval(timer);
  }, [live, reloadBoxScore]);
  const stats = boxScore.data ? boxScore.data[side] : undefined;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.scoreboard}>
        <Pressable style={styles.team} onPress={() => openTeam(Number(p.homeId), p.homeName, p.homeLogo || null)}>
          <TeamLogo uri={p.homeLogo || null} name={p.homeName} size={72} />
          <Text style={styles.teamName} numberOfLines={2}>{p.homeName}</Text>
        </Pressable>
        <View style={styles.center}>
          {played ? (
            <Text style={styles.score}>{p.homeScore}-{p.awayScore}</Text>
          ) : (
            <Text style={styles.vs}>VS</Text>
          )}
          <Text style={styles.date}>{formatWeekday(startsAt)} {formatDayMonth(startsAt)}</Text>
          <Text style={styles.time}>{formatTime(startsAt)}</Text>
        </View>
        <Pressable style={styles.team} onPress={() => openTeam(Number(p.awayId), p.awayName, p.awayLogo || null)}>
          <TeamLogo uri={p.awayLogo || null} name={p.awayName} size={72} />
          <Text style={styles.teamName} numberOfLines={2}>{p.awayName}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Tab label="CASA" name={p.homeName} active={side === 'home'} onPress={() => setSide('home')} />
        <Tab label="OSPITI" name={p.awayName} active={side === 'away'} onPress={() => setSide('away')} />
      </View>

      {roster.loading ? (
        <Loading label="Carico il roster…" />
      ) : roster.error ? (
        <ErrorView onRetry={roster.reload} />
      ) : roster.data ? (
        <RosterList roster={roster.data} stats={stats} onPlayer={(id) => router.push({ pathname: '/player/[id]', params: { id: String(id) } })} />
      ) : null}
    </ScrollView>
  );
}

function RosterList({ roster, stats, onPlayer }: { roster: Roster; stats?: Record<number, StatLine>; onPlayer: (id: number) => void }) {
  if (roster.players.length === 0) return <Empty text="Roster non ancora disponibile." />;
  return (
    <View>
      {roster.coach ? (
        <View style={styles.coach}>
          <Text style={styles.coachLabel}>HEAD COACH</Text>
          <Text style={styles.coachName}>{roster.coach.firstName} {roster.coach.lastName}</Text>
        </View>
      ) : null}
      {sortByPerformance(roster.players, stats).map((pl) => (
        <PlayerRow key={pl.id} player={pl} stats={stats ? (stats[pl.id] ?? undefined) : undefined} onPress={() => onPlayer(pl.id)} />
      ))}
    </View>
  );
}

function sortByPerformance<T extends { id: number }>(players: T[], stats?: Record<number, StatLine>): T[] {
  if (!stats) return players;
  return [...players].sort((a, b) => {
    const sa = stats[a.id];
    const sb = stats[b.id];
    if (!sa || !sb) return sa ? -1 : sb ? 1 : 0;
    return (
      sb.points - sa.points ||
      sb.assists - sa.assists ||
      sb.totalRebounds - sa.totalRebounds ||
      sb.minutes - sa.minutes
    );
  });
}

function Tab({ label, name, active, onPress }: { label: string; name: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      <Text style={[styles.tabName, active && styles.tabNameActive]} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scoreboard: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 18, backgroundColor: colors.surface, borderRadius: 28, borderWidth: 2, borderColor: colors.orange },
  team: { flex: 1, alignItems: 'center', gap: 8 },
  teamName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  center: { alignItems: 'center', gap: 2, minWidth: 90 },
  vs: { color: colors.orange, fontFamily: fonts.display, fontSize: 44, transform: [{ skewX: '-10deg' }] },
  score: { color: colors.yellow, fontFamily: fonts.display, fontSize: 40 },
  date: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1 },
  time: { color: colors.cyan, fontFamily: fonts.display, fontSize: 26, letterSpacing: 1 },
  tabs: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  tab: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 2, borderColor: colors.border },
  tabActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1.5 },
  tabLabelActive: { color: colors.bg },
  tabName: { color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.5 },
  tabNameActive: { color: colors.bg },
  coach: { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  coachLabel: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.5 },
  coachName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15 },
});
