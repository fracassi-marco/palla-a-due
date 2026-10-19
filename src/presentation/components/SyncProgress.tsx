import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncPhase, SyncState } from '../../application/SyncLeague';
import { colors, fonts, radius } from '../theme';

const PHASE_LABEL: Record<SyncPhase, string> = {
  calendar: 'Calendario',
  boxScores: 'Statistiche delle partite',
  rosters: 'Roster',
};

function label(state: SyncState): string {
  const phase = state.phase ? PHASE_LABEL[state.phase] : 'Aggiornamento';
  return state.total > 0 ? `${phase} · ${state.done}/${state.total}` : `${phase}…`;
}

function Bar({ state }: { state: SyncState }) {
  const fraction = state.total > 0 ? Math.min(state.done / state.total, 1) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
    </View>
  );
}

/** Barra in fondo allo schermo, visibile su ogni pagina finché i dati vengono scaricati in background. */
export function SyncBar({ state }: { state: SyncState }) {
  const insets = useSafeAreaInsets();
  if (state.status !== 'running' || state.total === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      <Text style={styles.barLabel}>SCARICO I DATI · {label(state).toUpperCase()}</Text>
      <Bar state={state} />
    </View>
  );
}

/** Schermata del primo avvio: finché il calendario non è nel database non c'è nulla da mostrare. */
export function FirstSync({ state, onRetry }: { state: SyncState; onRetry: () => void }) {
  const failed = state.status === 'error';
  return (
    <View style={styles.first}>
      <Ionicons name={failed ? 'basketball-outline' : 'basketball'} size={64} color={failed ? colors.pink : colors.orange} />
      <Text style={styles.title}>{failed ? 'FALLO DI SQUADRA!' : 'PRIMO AVVIO'}</Text>
      <Text style={styles.text}>
        {failed
          ? (state.error ?? 'Non riesco a scaricare i dati.')
          : 'Scarico il calendario del campionato: serve solo la prima volta.'}
      </Text>
      {failed ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>RIPROVA</Text>
        </Pressable>
      ) : (
        <View style={styles.firstProgress}>
          <Bar state={state} />
          <Text style={styles.progressLabel}>{label(state)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, gap: 6, backgroundColor: 'rgba(11,16,32,0.94)', borderTopWidth: 1.5, borderTopColor: colors.border },
  barLabel: { color: colors.cyan, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.5 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.orange },
  first: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.bg },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, letterSpacing: 1 },
  text: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  firstProgress: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  progressLabel: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, letterSpacing: 1.5, textAlign: 'center' },
  button: { backgroundColor: colors.orange, paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.pill, marginTop: 6 },
  buttonText: { color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
});
