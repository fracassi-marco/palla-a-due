import * as Sharing from 'expo-sharing';
import { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

/** Tempo per far disegnare la scheda e caricare i loghi (già in cache, perché visti a schermo) prima dello scatto. */
const RENDER_DELAY_MS = 450;

/**
 * Condivide come immagine PNG una scheda React: `share(card)` la monta fuori schermo, la fotografa
 * e apre il foglio di condivisione. `host` va reso una volta nella schermata.
 */
export function useShareImage(dialogTitle: string): { share: (card: ReactElement) => void; host: ReactNode; busy: boolean } {
  const [card, setCard] = useState<ReactElement | null>(null);
  const shot = useRef<ViewShotRef>(null);

  const share = useCallback((next: ReactElement) => setCard((current) => current ?? next), []);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, RENDER_DELAY_MS));
      if (cancelled || !shot.current?.capture || !(await Sharing.isAvailableAsync())) return;
      const uri = await shot.current.capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    };
    run()
      .catch(() => {})
      .finally(() => !cancelled && setCard(null));
    return () => {
      cancelled = true;
    };
  }, [card, dialogTitle]);

  const host = card ? (
    <View pointerEvents="none" style={styles.offscreen}>
      <ViewShot ref={shot} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
        {card}
      </ViewShot>
    </View>
  ) : null;

  return { share, host, busy: card !== null };
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -10_000, top: 0 },
});
