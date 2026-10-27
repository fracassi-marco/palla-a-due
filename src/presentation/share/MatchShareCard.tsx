import { StyleSheet, Text, View } from 'react-native';
import { MatchStatus } from '../../domain/entities';
import { TeamLogo } from '../components/TeamLogo';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth, formatTime, formatWeekday } from '../theme/format';
import { ShareFrame } from './ShareFrame';

export interface Performer {
  name: string;
  points: number;
  rebounds: number;
  assists: number;
}

interface TeamInfo {
  name: string;
  logo: string | null;
  score: number | string;
  performers: Performer[];
}

interface Props {
  leagueTitle: string;
  status: MatchStatus;
  startsAt: Date;
  home: TeamInfo;
  away: TeamInfo;
}

export function MatchShareCard({ leagueTitle, status, startsAt, home, away }: Props) {
  const played = status !== 'scheduled';
  const when = `${formatWeekday(startsAt)} ${formatDayMonth(startsAt)}`;
  return (
    <ShareFrame kicker={leagueTitle}>
      <View style={styles.scoreboard}>
        <TeamSide team={home} />
        <View style={styles.center}>
          {played ? <Text style={styles.score}>{home.score}-{away.score}</Text> : <Text style={styles.vs}>VS</Text>}
          <Text style={styles.state}>{status === 'live' ? '● LIVE' : status === 'finished' ? 'FINALE' : formatTime(startsAt)}</Text>
          <Text style={styles.date}>{when}</Text>
        </View>
        <TeamSide team={away} />
      </View>
      {played && (home.performers.length > 0 || away.performers.length > 0) ? (
        <View style={styles.columns}>
          <Performers performers={home.performers} />
          <Performers performers={away.performers} />
        </View>
      ) : null}
    </ShareFrame>
  );
}

function TeamSide({ team }: { team: TeamInfo }) {
  return (
    <View style={styles.side}>
      <TeamLogo uri={team.logo} name={team.name} size={64} />
      <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
    </View>
  );
}

function Performers({ performers }: { performers: Performer[] }) {
  return (
    <View style={styles.performers}>
      {performers.map((p) => (
        <View key={p.name} style={styles.performer}>
          <Text style={styles.performerName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.performerStats}>
            <Text style={styles.points}>{p.points}</Text> PT · {p.rebounds} R · {p.assists} A
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreboard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.orange },
  side: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  center: { alignItems: 'center', gap: 2, minWidth: 90 },
  score: { color: colors.yellow, fontFamily: fonts.display, fontSize: 40 },
  vs: { color: colors.orange, fontFamily: fonts.display, fontSize: 40, transform: [{ skewX: '-10deg' }] },
  state: { color: colors.orange, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.5 },
  date: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1 },
  columns: { flexDirection: 'row', gap: 10 },
  performers: { flex: 1, gap: 8 },
  performer: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: 8, gap: 2, borderWidth: 1, borderColor: colors.border },
  performerName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  performerStats: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 0.5 },
  points: { color: colors.yellow, fontFamily: fonts.display, fontSize: 18 },
});
