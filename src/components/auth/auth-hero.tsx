import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Gradient } from '@/components/ui/gradient';
import { Gradients, Radius, Spacing } from '@/constants/theme';

const MARK = require('../../../assets/images/mark-white.png');

/** Visible hero height without the status-bar inset (DESIGN 3.13). */
export const AUTH_HERO_HEIGHT = { tall: 240, short: 180 } as const;

/** How far the content sheet overlaps the hero. */
export const AUTH_SHEET_OVERLAP = Spacing.five;

export type AuthHeroProps = {
  size?: keyof typeof AUTH_HERO_HEIGHT;
};

/** Brand gradient header with the temporary logo and tagline. Always uses light status-bar icons. */
export function AuthHero({ size = 'tall' }: AuthHeroProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, { height: AUTH_HERO_HEIGHT[size] + insets.top, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <Gradient {...Gradients.brand} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <View style={styles.logo} accessible accessibilityRole="image" accessibilityLabel="onMyWay">
          <Image
            source={MARK}
            contentFit="contain"
            accessible={false}
            style={styles.mark}
          />
          <ThemedText type="display" themeColor="onPrimary" accessible={false}>
            onMyWay
          </ThemedText>
        </View>
        <ThemedText type="bodyStrong" themeColor="onPrimary" style={styles.tagline}>
          Share the journey. Follow the way.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    overflow: 'hidden',
  },
  // Bottom padding keeps the content clear of the sheet overlapping the hero.
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: AUTH_SHEET_OVERLAP,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: { width: 56, height: 56 },
  tagline: { textAlign: 'center' },
});
