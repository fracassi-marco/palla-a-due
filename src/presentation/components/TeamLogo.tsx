import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { resolveImageSource } from '../../infrastructure/images';
import { colors, fonts } from '../theme';

interface Props {
  uri: string | null;
  name: string;
  size?: number;
}

export function TeamLogo({ uri, name, size = 40 }: Props) {
  if (uri) {
    return <Image source={resolveImageSource(uri)} style={{ width: size, height: size }} contentFit="contain" transition={150} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.5 }]}>{name.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.orange, fontFamily: fonts.display },
});
