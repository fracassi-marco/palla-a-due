import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HeadToHead } from '../../application/GetHeadToHead';
import { Match } from '../../domain/entities';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth } from '../theme/format';
import { SectionTitle } from './SectionTitle';

interface Props {
  headToHead: HeadToHead;
  homeCode: string;
  awayCode: string;
  onMatch: (m: Match) => void;
}

export function HeadToHeadSection({ headToHead, homeCode, awayCode, onMatch }: Props) {
  const { matches, homeWins, awayWins } = headToHead;
  return (
    <View>
      <SectionTitle title="SCONTRI DIRETTI" accent={colors.pink} right={`ULTIME ${matches.length}`} />
      <View style={styles.balance}>
        <Text style={[styles.wins, homeWins > awayWins && styles.leading]}>{homeWins}</Text>
        <Text style={styles.balanceLabel}>{homeCode} · VITTORIE · {awayCode}</Text>
        <Text style={[styles.wins, awayWins > homeWins && styles.leading]}>{awayWins}</Text>
      </View>
      <View style={styles.list}>
        {matches.map((m) => {
          const homeWon = (m.homeScore ?? 0) > (m.awayScore ?? 0);
          return (
            <Pressable key={m.id} onPress={() => onMatch(m)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.date}>{formatDayMonth(m.startsAt)} {String(m.startsAt.getFullYear()).slice(2)}</Text>
              <Text style={[styles.code, homeWon && styles.winner]} numberOfLines={1}>{m.home.code}</Text>
              <Text style={styles.score}>{m.homeScore}-{m.awayScore}</Text>
              <Text style={[styles.code, !homeWon && styles.winner]} numberOfLines={1}>{m.away.code}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  wins: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  leading: { color: colors.yellow },
  balanceLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.2 },
  list: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 46 },
  pressed: { opacity: 0.6 },
  date: { width: 64, color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 0.8 },
  code: { flex: 1, color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 15, textAlign: 'center' },
  winner: { color: colors.text },
  score: { color: colors.yellow, fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5 },
});
