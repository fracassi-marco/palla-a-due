import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Match } from '../../domain/entities';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth, formatTime, formatWeekday } from '../theme/format';
import { TeamLogo } from './TeamLogo';

interface Props {
  match: Match;
  onPress: () => void;
  width?: number;
}

export function MatchCard({ match, onPress, width }: Props) {
  const live = match.status === 'live';
  const played = match.status !== 'scheduled';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <LinearGradient colors={[colors.surfaceAlt, colors.surface]} style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.day}>{match.dayName.toUpperCase()}</Text>
          {live ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.teams}>
          <TeamSide name={match.home.name} logo={match.home.logoUrl} code={match.home.code} />
          <View style={styles.middle}>
            {played ? (
              <Text style={styles.score}>
                {match.homeScore ?? 0}-{match.awayScore ?? 0}
              </Text>
            ) : (
              <Text style={styles.vs}>VS</Text>
            )}
          </View>
          <TeamSide name={match.away.name} logo={match.away.logoUrl} code={match.away.code} />
        </View>

        <View style={styles.when}>
          <Text style={styles.whenDate}>
            {formatWeekday(match.startsAt)} {formatDayMonth(match.startsAt)}
          </Text>
          <Text style={styles.whenTime}>{formatTime(match.startsAt)}</Text>
        </View>
        {match.venue || match.city ? (
          <Text style={styles.venue} numberOfLines={1}>
            {[match.venue, match.city].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

function TeamSide({ name, logo, code }: { name: string; logo: string | null; code: string }) {
  return (
    <View style={styles.side}>
      <TeamLogo uri={logo} name={name} size={56} />
      <Text style={styles.code}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.97 }] },
  card: { borderRadius: radius.lg, padding: 16, borderWidth: 1.5, borderColor: colors.border, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.5 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.red, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.text },
  liveText: { color: colors.text, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1 },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', gap: 6, width: 80 },
  code: { color: colors.text, fontFamily: fonts.display, fontSize: 22, letterSpacing: 1 },
  middle: { alignItems: 'center' },
  vs: { color: colors.orange, fontFamily: fonts.display, fontSize: 34, transform: [{ skewX: '-10deg' }] },
  score: { color: colors.yellow, fontFamily: fonts.display, fontSize: 34 },
  when: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 8 },
  whenDate: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 15, letterSpacing: 1 },
  whenTime: { color: colors.yellow, fontFamily: fonts.display, fontSize: 22, letterSpacing: 1 },
  venue: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
});
