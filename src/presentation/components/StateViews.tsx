import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

export function Loading({ label = 'Palla a due…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.orange} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ErrorView({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name="basketball-outline" size={48} color={colors.pink} />
      <Text style={styles.title}>FALLO DI SQUADRA!</Text>
      <Text style={styles.label}>{message ?? 'Non riesco a caricare i dati.'}</Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>RIPROVA</Text>
      </Pressable>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name="time-outline" size={36} color={colors.textMuted} />
      <Text style={styles.label}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  label: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  button: { backgroundColor: colors.orange, paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.pill, marginTop: 6 },
  buttonText: { color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
});
