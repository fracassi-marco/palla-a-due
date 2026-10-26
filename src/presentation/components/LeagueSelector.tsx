import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LEAGUES } from '../../domain/League';
import { setLeague, useLeague } from '../hooks/useLeague';
import { colors, fonts, radius } from '../theme';

/** Scelta del campionato: LBA, NBA, WNBA, Serie A2, Serie B, EuroLeague o EuroCup. */
export function LeagueSelector() {
  const current = useLeague();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {LEAGUES.map(({ id, label }) => {
        const active = id === current;
        return (
          <Pressable
            key={id}
            onPress={() => setLeague(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: 14 },
  row: { gap: 8, paddingHorizontal: 16 },
  option: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  optionActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  label: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  labelActive: { color: colors.bg },
});
