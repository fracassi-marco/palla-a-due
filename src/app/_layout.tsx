import { Barlow_500Medium, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Loading } from '../presentation/components/StateViews';
import { colors, fonts } from '../presentation/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ BebasNeue_400Regular, Barlow_500Medium, Barlow_700Bold, BarlowCondensed_700Bold });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
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
        <Stack.Screen name="match/[id]" options={{ title: 'PARTITA' }} />
        <Stack.Screen name="player/[id]" options={{ title: 'GIOCATORE' }} />
      </Stack>
    </>
  );
}
