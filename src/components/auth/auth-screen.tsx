import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHero, AUTH_SHEET_OVERLAP, type AuthHeroProps } from './auth-hero';

import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AuthScreenProps = AuthHeroProps & {
  children: ReactNode;
};

/** Scrollable auth layout: brand hero on top, rounded content sheet overlapping it. */
export function AuthScreen({ size, children }: AuthScreenProps) {
  const theme = useTheme();

  return (
    <Screen
      scroll
      padded={false}
      edges={['left', 'right', 'bottom']}
      contentContainerStyle={styles.fullBleed}>
      <AuthHero size={size} />
      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <View style={styles.sheetContent}>{children}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Hero and sheet span the full width and touch (the Screen default adds a gap and max width).
  fullBleed: { gap: 0, maxWidth: '100%' },
  sheet: {
    flexGrow: 1,
    marginTop: -AUTH_SHEET_OVERLAP,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.four,
  },
  sheetContent: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.three },
});
