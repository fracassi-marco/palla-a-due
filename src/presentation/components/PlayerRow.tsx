import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Player } from '../../domain/entities';
import { colors, fonts, radius } from '../theme';

export function PlayerRow({ player, onPress }: { player: Player; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.photoWrap}>
        {player.photoUrl ? (
          <Image source={{ uri: player.photoUrl }} style={styles.photo} contentFit="cover" contentPosition="top" transition={150} />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1.5, borderColor: colors.border, marginHorizontal: 16, marginBottom: 10 },
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
