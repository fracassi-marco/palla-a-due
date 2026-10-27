import { StyleSheet, Text, View } from 'react-native';
import { Standing } from '../../domain/entities';
import { TeamLogo } from '../components/TeamLogo';
import { colors, fonts, radius } from '../theme';
import { ShareFrame } from './ShareFrame';

const percentage = (value: number) => (value >= 1 ? '1.000' : value.toFixed(3).slice(1));

interface Props {
  leagueTitle: string;
  groupName: string | null;
  standings: Standing[];
  byWinPercentage: boolean;
}

export function StandingsShareCard({ leagueTitle, groupName, standings, byWinPercentage }: Props) {
  return (
    <ShareFrame kicker={groupName ? `${leagueTitle} · ${groupName.toUpperCase()}` : leagueTitle}>
      <Text style={styles.title}>CLASSIFICA</Text>
      <View style={styles.table}>
        <View style={[styles.row, styles.head]}>
          <Text style={[styles.headText, styles.pos]}>#</Text>
          <Text style={[styles.headText, styles.team]}>SQUADRA</Text>
          <Text style={[styles.headText, styles.num]}>G</Text>
          <Text style={[styles.headText, styles.num]}>V</Text>
          <Text style={[styles.headText, styles.num]}>P</Text>
          <Text style={[styles.headText, styles.pts]}>{byWinPercentage ? 'PCT' : 'PT'}</Text>
        </View>
        {standings.map((s, i) => {
          const zone = s.relegation ? colors.red : s.playoffQualified ? colors.green : s.playIn ? colors.orange : 'transparent';
          return (
            <View key={s.team.id} style={[styles.row, i % 2 === 0 && styles.zebra]}>
              <View style={[styles.zone, { backgroundColor: zone }]} />
              <Text style={[styles.posText, styles.pos, s.position <= 3 && { color: colors.yellow }]}>{s.position}</Text>
              <View style={[styles.team, styles.teamCell]}>
                <TeamLogo uri={s.team.logoUrl} name={s.team.name} size={22} />
                <Text style={styles.teamName} numberOfLines={1}>{s.team.name}</Text>
              </View>
              <Text style={[styles.cell, styles.num]}>{s.played}</Text>
              <Text style={[styles.cell, styles.num]}>{s.wins}</Text>
              <Text style={[styles.cell, styles.num]}>{s.losses}</Text>
              <Text style={[styles.ptsText, styles.pts]}>{byWinPercentage ? percentage(s.winPercentage) : s.points}</Text>
            </View>
          );
        })}
      </View>
    </ShareFrame>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30, letterSpacing: 1.2, textAlign: 'center' },
  table: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingRight: 8 },
  head: { backgroundColor: colors.surfaceAlt, paddingVertical: 6 },
  headText: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1 },
  zebra: { backgroundColor: 'rgba(255,255,255,0.03)' },
  zone: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  pos: { width: 30, textAlign: 'center' },
  posText: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  team: { flex: 1 },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13, flexShrink: 1 },
  num: { width: 26, textAlign: 'center' },
  cell: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  pts: { width: 40, textAlign: 'center' },
  ptsText: { color: colors.yellow, fontFamily: fonts.display, fontSize: 18 },
});
