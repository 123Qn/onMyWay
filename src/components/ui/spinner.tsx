import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';

export type SpinnerProps = {
  /** 'sm' = 20px, 'md' = 24px, 'lg' = 36px glyph. */
  size?: 'sm' | 'md' | 'lg';
  color?: ThemeColor;
  style?: StyleProp<ViewStyle>;
};

const BOX = { sm: 20, md: 24, lg: 36 } as const;

/**
 * ActivityIndicator inside a fixed-size box. Bare indicators collapse to a dot on Android
 * Fabric when their parent has no intrinsic size, so the box and the indicator are sized explicitly.
 */
export function Spinner({ size = 'md', color = 'textMuted', style }: SpinnerProps) {
  const theme = useTheme();
  const box = BOX[size];
  return (
    <View collapsable={false} style={[styles.box, { width: box, height: box }, style]}>
      <ActivityIndicator
        size={size === 'lg' ? 'large' : 'small'}
        color={theme[color]}
        style={{ width: box, height: box }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
