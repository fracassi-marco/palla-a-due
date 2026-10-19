import { StyleSheet, Text, View } from 'react-native';
import { Standing } from '../../domain/entities';
import { colors, fonts, radius } from '../theme';
import { TeamLogo } from './TeamLogo';

export function StandingsTable({ standings }: { standings: Standing[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.headText, styles.pos]}>#</Text>
        <Text style={[styles.headText, styles.team]}>SQUADRA</Text>
        <Text style={[styles.headText, styles.num]}>G</Text>
        <Text style={[styles.headText, styles.num]}>V</Text>
        <Text style={[styles.headText, styles.num]}>P</Text>
        <Text style={[styles.headText, styles.pts]}>PT</Text>
      </View>
      {standings.map((s, i) => {
        const zone = s.relegation ? colors.red : s.playoffQualified ? colors.green : s.position <= 8 ? colors.orange : 'transparent';
        return (
          <View key={s.team.id} style={[styles.row, i % 2 === 0 && styles.zebra]}>
            <View style={[styles.zone, { backgroundColor: zone }]} />
            <Text style={[styles.posText, styles.pos, s.position <= 3 && { color: colors.yellow }]}>{s.position}</Text>
            <View style={[styles.team, styles.teamCell]}>
              <TeamLogo uri={s.team.logoUrl} name={s.team.name} size={28} />
              <Text style={styles.teamName} numberOfLines={1}>
                {s.team.name}
              </Text>
            </View>
            <Text style={[styles.cell, styles.num]}>{s.played}</Text>
            <Text style={[styles.cell, styles.num]}>{s.wins}</Text>
            <Text style={[styles.cell, styles.num]}>{s.losses}</Text>
            <View style={styles.pts}>
              <Text style={styles.ptsText}>{s.points}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 10, minHeight: 50 },
  head: { backgroundColor: colors.surfaceAlt, paddingVertical: 8, minHeight: 0 },
  headText: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1 },
  zebra: { backgroundColor: 'rgba(255,255,255,0.03)' },
  zone: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  pos: { width: 36, textAlign: 'center' },
  posText: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  team: { flex: 1 },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14, flexShrink: 1 },
  num: { width: 28, textAlign: 'center' },
  cell: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  pts: { width: 40, alignItems: 'center', justifyContent: 'center' },
  ptsText: { color: colors.yellow, fontFamily: fonts.display, fontSize: 24 },
});
