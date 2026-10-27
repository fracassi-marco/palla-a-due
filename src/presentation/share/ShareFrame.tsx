import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Larghezza fissa delle schede condivise: l'immagine esce uguale su ogni schermo. */
export const SHARE_CARD_WIDTH = 360;

/** Cornice comune delle immagini condivise: titolo del campionato in alto, marchio in basso. */
export function ShareFrame({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <View style={styles.frame}>
      <Text style={styles.kicker}>{kicker}</Text>
      {children}
      <Text style={styles.brand}>PALLA A DUE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SHARE_CARD_WIDTH, backgroundColor: colors.bg, padding: 16, gap: 14 },
  kicker: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 15, letterSpacing: 2, textAlign: 'center' },
  brand: { color: colors.orange, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, textAlign: 'center', transform: [{ skewX: '-6deg' }] },
});
