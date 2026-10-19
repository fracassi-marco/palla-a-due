import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Player, StatLine } from '../../domain/entities';
import { resolveImageSource } from '../../infrastructure/images';
import { colors, fonts, radius } from '../theme';

export function PlayerRow({ player, stats, onPress }: { player: Player; stats?: StatLine; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
      <View style={styles.photoWrap}>
        {player.photoUrl ? (
          <Image source={resolveImageSource(player.photoUrl)} style={styles.photo} contentFit="cover" contentPosition="top" transition={150} />
        ) : (
          <Ionicons name="person" size={28} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.first} numberOfLines={1}>
          {player.firstName}
        </Text>
        <Text style={styles.last} numberOfLines={1}>
          {player.lastName.toUpperCase()}
        </Text>
        <View style={styles.meta}>
          {player.role ? <Text style={styles.chip}>{player.role}</Text> : null}
          {player.heightCm ? <Text style={styles.height}>{player.heightCm} cm</Text> : null}
        </View>
      </View>
      <Text style={styles.number}>{player.number}</Text>
      </View>
      {stats ? <GameStats line={stats} /> : null}
    </Pressable>
  );
}

function GameStats({ line }: { line: StatLine }) {
  if (line.minutes === 0 && line.points === 0 && line.fouls === 0) {
    return <Text style={styles.dnp}>NON HA GIOCATO</Text>;
  }
  return (
    <View style={styles.stats}>
      <View style={styles.main}>
        <Stat label="MIN" value={String(line.minutes)} />
        <Stat label="PT" value={String(line.points)} highlight />
        <Stat label="RB" value={String(line.totalRebounds)} />
        <Stat label="AS" value={String(line.assists)} />
        <Stat label="VAL" value={String(line.rating)} />
      </View>
      <Text style={styles.detail}>
        2P {line.twoMade}/{line.twoAttempted} · 3P {line.threeMade}/{line.threeAttempted} · TL {line.freeThrowsMade}/{line.freeThrowsAttempted}
      </Text>
      <Text style={styles.detail}>
        PR {line.steals} · PP {line.turnovers} · ST {line.blocks} · FL {line.fouls}
      </Text>
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1.5, borderColor: colors.border, marginHorizontal: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stats: { marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: colors.border, gap: 4 },
  main: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  statHighlight: { color: colors.yellow },
  statLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 11, letterSpacing: 1 },
  detail: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 0.5, textAlign: 'center' },
  dnp: { marginTop: 8, color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1.5, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.98 }], borderColor: colors.orange },
  photoWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.orange },
  photo: { width: '100%', height: '100%' },
  info: { flex: 1 },
  first: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  last: { color: colors.text, fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.8, lineHeight: 26 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chip: { color: colors.bg, backgroundColor: colors.cyan, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 0.5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  height: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  number: { color: colors.orange, fontFamily: fonts.display, fontSize: 44, minWidth: 48, textAlign: 'right', transform: [{ skewX: '-8deg' }] },
});
