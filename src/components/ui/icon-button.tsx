import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';

import { GlassSurface } from './glass-surface';
import { Spinner } from '@/components/ui/spinner';
import { Layout, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: 'md' | 'lg';
  variant?: 'plain' | 'filled' | 'glass';
  color?: ThemeColor;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const BOX = { md: Layout.minTouchTarget, lg: 48 } as const;
const GLYPH = { md: Layout.iconSize.md, lg: Layout.iconSize.lg } as const;

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 'md',
  variant = 'plain',
  color = 'text',
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const box = BOX[size];

  return (
    <Pressable collapsable={false}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box, borderRadius: Radius.full },
        variant === 'filled' && { backgroundColor: theme.surfaceMuted },
        pressed && variant !== 'glass' && { backgroundColor: theme.border },
        pressed && variant === 'glass' && styles.glassPressed,
        disabled && styles.disabled,
        style,
      ]}>
      {variant === 'glass' ? (
        <GlassSurface radius={Radius.full} style={StyleSheet.absoluteFill} />
      ) : null}
      {loading ? (
        <Spinner color={color} />
      ) : (
        <Icon name={icon} size={GLYPH[size]} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  glassPressed: { opacity: 0.8 },
});
