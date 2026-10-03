import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Layout, Spacing } from '@/constants/theme';

export type HeaderTextButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  bold?: boolean;
};

/** Text button for native stack headers (Cancel / Save / Publish). */
export function HeaderTextButton({ label, onPress, disabled, loading, bold }: HeaderTextButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={8}
      style={styles.button}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <ThemedText
          themeColor="primary"
          type={bold ? 'bodyStrong' : 'default'}
          style={disabled ? styles.disabled : undefined}>
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
