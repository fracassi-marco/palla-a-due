import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
  /** Riga secondaria sotto l'etichetta, es. la posizione in classifica. */
  hint?: string;
  /** Se presente il riquadro è premibile (es. per aprire la classifica). */
  onPress?: () => void;
}

export function StatTile({ label, value, accent = colors.orange, big, hint, onPress }: Props) {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={[styles.tile, big && styles.big, { borderColor: accent }]} onPress={onPress}>
      <Text style={[styles.value, big && styles.valueBig, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: accent }]}>{hint}</Text> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 72, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 2, paddingVertical: 12, alignItems: 'center' },
  big: { paddingVertical: 18 },
  value: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  valueBig: { fontSize: 46, lineHeight: 48 },
  hint: { fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1, marginTop: 2 },
  label: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.2, marginTop: 2 },
});
