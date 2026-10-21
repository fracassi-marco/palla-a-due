import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCases, warmUpLeagues } from '../di/container';
import { LeagueSelector } from '../presentation/components/LeagueSelector';
import { Loading } from '../presentation/components/StateViews';
import { FirstSync, SyncBar } from '../presentation/components/SyncProgress';
import { useLeague } from '../presentation/hooks/useLeague';
import { useSyncState } from '../presentation/hooks/useSync';
import { colors, fonts } from '../presentation/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ BebasNeue_400Regular, Barlow_500Medium, Barlow_700Bold, BarlowCondensed_700Bold });
  const sync = useSyncState();
  const league = useLeague();

  // Il database si aggiorna in background: all'avvio, quando si cambia campionato e ogni volta che l'app torna in primo piano.
  useEffect(() => {
    void useCases.sync.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useCases.sync.resume();
    });
    return () => subscription.remove();
  }, [league]);

  useEffect(() => {
    if (loaded) warmUpLeagues();
  }, [loaded]);

  if (!loaded || (sync.ready === null && sync.status !== 'error')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  // Senza il calendario nel database non c'è nulla da mostrare: solo al primissimo avvio.
  // Il selettore resta disponibile: un campionato che non si scarica non deve bloccare gli altri.
  if (!sync.ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <LeagueSelector />
        <FirstSync state={sync} onRetry={() => void useCases.sync.start()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.orange,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
          headerShadowVisible: false,
          headerBackTitle: 'Indietro',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="calendar" options={{ title: 'CALENDARIO' }} />
        <Stack.Screen name="settings" options={{ title: 'IMPOSTAZIONI' }} />
        <Stack.Screen name="match/[id]" options={{ title: 'PARTITA' }} />
        <Stack.Screen name="team/[id]" options={{ title: 'SQUADRA' }} />
        <Stack.Screen name="player/[id]" options={{ title: 'GIOCATORE' }} />
        <Stack.Screen name="ranking/[stat]" options={{ title: 'CLASSIFICA' }} />
      </Stack>
      <SyncBar state={sync} />
    </View>
  );
}
