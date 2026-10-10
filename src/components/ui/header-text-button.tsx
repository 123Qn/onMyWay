import { Pressable, StyleSheet } from 'react-native';

import { Spinner } from '@/components/ui/spinner';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Layout, Spacing } from '@/constants/theme';

export type HeaderTextButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  bold?: boolean;
  /** 'neutral' (Cancel) uses the text colour; 'primary' (Save/Publish) the accent. */
  tone?: 'primary' | 'neutral';
};

/** Text button for native stack headers (Cancel / Save / Publish). */
export function HeaderTextButton({ label, onPress, disabled, loading, bold, tone = 'primary' }: HeaderTextButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={8}
      style={styles.button}>
      {loading ? (
        <Spinner color={tone === 'neutral' ? 'text' : 'primary'} />
      ) : (
        <ThemedText
          themeColor={tone === 'neutral' ? 'text' : 'primary'}
          type={bold ? 'bodyStrong' : 'default'}
          style={[{ fontFamily: FontFamily.semibold }, disabled ? styles.disabled : null]}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: Layout.minTouchTarget,
    minWidth: Layout.minTouchTarget,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
