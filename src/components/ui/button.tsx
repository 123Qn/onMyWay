import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing, shadow, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Adds the floating-CTA shadow (only with primary, size lg). */
  floating?: boolean;
  /** Ghost on a surfaceMuted/primarySoft fill: uses primaryPressed for contrast. */
  tone?: 'default' | 'onSoft';
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PADDING_X = { sm: 16, md: 20, lg: 24 } as const;
const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 } as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  floating = false,
  tone = 'default',
  icon,
  iconPosition = 'left',
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const textColor: ThemeColor =
    variant === 'primary'
      ? 'onPrimary'
      : variant === 'destructive'
        ? 'onDanger'
        : variant === 'ghost'
          ? tone === 'onSoft'
            ? 'primaryPressed'
            : 'primary'
          : 'text';

  const iconNode = icon ? <Icon name={icon} size={Layout.iconSize.md} color={textColor} /> : null;

  return (
    <Pressable collapsable={false}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={size === 'sm' ? HIT_SLOP : undefined}
      style={({ pressed }) => [
        styles.base,
        { minHeight: Layout.controlHeight[size], borderRadius: Radius.full, paddingHorizontal: PADDING_X[size] },
        fullWidth ? styles.fullWidth : styles.intrinsic,
        variant === 'primary' && {
          backgroundColor: pressed ? theme.primaryPressed : theme.primary,
        },
        variant === 'secondary' && {
          backgroundColor: pressed ? theme.backgroundSelected : theme.surfaceMuted,
        },
        variant === 'destructive' && {
          backgroundColor: theme.danger,
          opacity: pressed ? 0.85 : 1,
        },
        variant === 'ghost' && {
          backgroundColor: pressed ? theme.primarySoft : 'transparent',
        },
        floating && variant === 'primary' && shadow(theme, 'fab', 'primary'),
        disabled && styles.disabled,
        style,
      ]}>
      <View collapsable={false} style={[styles.content, loading && styles.hidden]}>
        {iconPosition === 'left' ? iconNode : null}
        <ThemedText type={size === 'sm' ? 'smallBold' : 'bodyStrong'} themeColor={textColor}>
          {title}
        </ThemedText>
        {iconPosition === 'right' ? iconNode : null}
      </View>
      {loading ? (
        <View collapsable={false} style={styles.spinner}>
          <ActivityIndicator color={theme[textColor]} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  intrinsic: { minWidth: 88 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
