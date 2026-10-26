import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { BoxScore, MatchStatus, Roster, StatLine } from '../../domain/entities';
import { PlayerRow } from '../../presentation/components/PlayerRow';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { TeamLogo } from '../../presentation/components/TeamLogo';
import { useOpenTeam } from '../../presentation/hooks/useOpenTeam';
import { useAsync } from '../../presentation/hooks/useAsync';
import { useDataVersion } from '../../presentation/hooks/useSync';
import { usePolling } from '../../presentation/hooks/usePolling';
import { shareMatch } from '../../presentation/shareMatch';
import { colors, fonts, radius } from '../../presentation/theme';
import { formatDayMonth, formatTime, formatWeekday } from '../../presentation/theme/format';

type Params = Record<'id' | 'day' | 'homeId' | 'awayId' | 'homeName' | 'awayName' | 'homeLogo' | 'awayLogo' | 'startsAt' | 'status' | 'homeScore' | 'awayScore', string>;

const LIVE_REFRESH_MS = 12_000;
const PRE_GAME_WINDOW_MS = 30 * 60_000;

export default function MatchScreen() {
  const p = useLocalSearchParams<Params>();
  const router = useRouter();
  const openTeam = useOpenTeam();
  const [side, setSide] = useState<'home' | 'away'>('home');

  const dataVersion = useDataVersion();
  const matchId = Number(p.id);
  const teamId = Number(side === 'home' ? p.homeId : p.awayId);
  const roster = useAsync(() => useCases.getTeamRoster.execute(teamId), [teamId, dataVersion]);

  const startsAt = useMemo(() => new Date(p.startsAt), [p.startsAt]);
  const dayNumber = Number(p.day);

  // Stato e punteggio partono dai parametri di navigazione e poi si aggiornano dal database.
  const matchState = useAsync(
    () => (dayNumber > 0 ? useCases.getMatch.execute(matchId, dayNumber) : Promise.resolve(null)),
    [matchId, dayNumber, dataVersion],
  );
  const status = matchState.data?.status ?? (p.status as MatchStatus);
  const homeScore = matchState.data ? (matchState.data.homeScore ?? '') : p.homeScore;
  const awayScore = matchState.data ? (matchState.data.awayScore ?? '') : p.awayScore;
  const played = status !== 'scheduled';
  const live = status === 'live';

  // Le statistiche di una partita conclusa vengono dal database; quelle di una partita live non vengono salvate
  // (contano solo a partita conclusa) e restano qui, aggiornate dal polling.
  const [liveBox, setLiveBox] = useState<BoxScore | null>(null);
  const boxScore = useAsync(
    () => (played && !live ? useCases.getMatchBoxScore.execute(matchId) : Promise.resolve(null)),
    [matchId, played, live, dataVersion],
  );

  const refresh = useCallback(
    (force: boolean) => {
      useCases.sync
        .refreshMatch(matchId, force)
        .then((box) => box && setLiveBox(box))
        .catch(() => {});
    },
    [matchId],
  );

  // All'apertura si scarica solo ciò che il database non ha (nulla per una partita conclusa e già salvata).
  useEffect(() => refresh(false), [refresh]);

  const refreshLive = useCallback(() => {
    // Prima della palla a due si aggiorna solo nell'ultima mezz'ora, per accorgersi dell'inizio.
    if (!played && startsAt.getTime() - Date.now() > PRE_GAME_WINDOW_MS) return;
    refresh(true);
  }, [refresh, played, startsAt]);
  // Quando la partita risulta conclusa si fa un ultimo refresh forzato: il punteggio finale può correggersi subito dopo.
  usePolling(refreshLive, status !== 'finished', LIVE_REFRESH_MS, true);
  // Alla fine della partita le statistiche live restano a schermo finché non sono state rilette dal database.
  // Il database restituisce un box score vuoto finché non è stato scaricato: in quel caso vale quello live.
  const stored = boxScore.data && Object.keys(boxScore.data[side]).length > 0 ? boxScore.data : null;
  const stats = (stored ?? liveBox)?.[side];

  const share = () =>
    void shareMatch({ homeName: p.homeName, awayName: p.awayName, homeScore, awayScore, status, startsAt }).catch(() => {});

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={share} hitSlop={12} accessibilityLabel="Condividi il risultato">
              <Ionicons name="share-outline" size={24} color={colors.orange} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.scoreboard}>
        <Pressable style={styles.team} onPress={() => openTeam(Number(p.homeId), p.homeName, p.homeLogo || null)}>
          <TeamLogo uri={p.homeLogo || null} name={p.homeName} size={72} />
          <Text style={styles.teamName} numberOfLines={2}>{p.homeName}</Text>
        </Pressable>
        <View style={styles.center}>
          {played ? (
            <Text style={styles.score}>{homeScore}-{awayScore}</Text>
          ) : (
            <Text style={styles.vs}>VS</Text>
          )}
          {live ? <Text style={styles.live}>● LIVE{matchState.data?.liveLabel ? ` · ${matchState.data.liveLabel}` : ''}</Text> : null}
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
  live: { color: colors.orange, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.5 },
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
