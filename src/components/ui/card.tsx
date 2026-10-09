import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, shadow, type ShadowLevel } from '@/constants/theme';
import { useIsDark } from '@/hooks/use-is-dark';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = {
  children: ReactNode;
  variant?: 'elevated' | 'flat';
  padding?: number;
  radius?: keyof typeof Radius;
  /** Shadow level for the elevated variant (info tiles use 'sm'). */
  elevation?: Extract<ShadowLevel, 'sm' | 'md'>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Rounded surface. Two layers: outer view (fill, radius, shadow) and inner clip (overflow hidden). */
export function Card({
  children,
  variant = 'elevated',
  padding = Spacing.three,
  radius = 'lg',
  elevation = 'md',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();
  const isDark = useIsDark();
  const r = Radius[radius];
  const elevated = variant === 'elevated';

  const outer: ViewStyle[] = [
    { borderRadius: r, backgroundColor: elevated ? theme.surface : theme.surfaceMuted },
    ...(elevated ? [shadow(theme, elevation)] : []),
    ...(elevated && isDark ? [{ borderWidth: 1, borderColor: theme.border }] : []),
  ];

  const inner = <View style={[styles.clip, { borderRadius: r, padding }]}>{children}</View>;

  if (!onPress) {
    return (
      <View testID={testID} style={[outer, style]}>
        {inner}
      </View>
    );
  }

  return (
    <Pressable collapsable={false}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [outer, pressed && styles.pressed, style]}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
});
