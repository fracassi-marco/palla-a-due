import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function SectionTitle({ title, accent = colors.orange, right }: { title: string; accent?: string; right?: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Text style={styles.title}>{title}</Text>
      {right ? <Text style={styles.right}>{right}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 28, marginBottom: 14 },
  bar: { width: 6, height: 28, borderRadius: 3, transform: [{ skewX: '-12deg' }] },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, letterSpacing: 1.2, flex: 1 },
  right: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1 },
});
