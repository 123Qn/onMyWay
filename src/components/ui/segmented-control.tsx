import { PixelRatio, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<T extends string> = { value: T; label: string; icon: IconName };

export type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Large-text threshold: options stack as full-width rows so labels never truncate. */
const STACK_FONT_SCALE = 1.5;

/** Single-choice control with icon and label per segment. Selection shows in border, weight and state. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const stacked = PixelRatio.getFontScale() >= STACK_FONT_SCALE;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[stacked ? styles.stack : styles.row, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable collapsable={false}
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              stacked ? styles.segmentStacked : styles.segmentInline,
              {
                backgroundColor: selected
                  ? theme.primarySoft
                  : pressed
                    ? theme.backgroundSelected
                    : theme.surfaceMuted,
                borderColor: selected ? theme.primary : 'transparent',
                opacity: disabled ? 0.4 : 1,
              },
            ]}>
            <Icon name={o.icon} size={20} color={selected ? 'primary' : 'text'} />
            <ThemedText
              type={selected ? 'bodyStrong' : 'small'}
              themeColor={selected ? 'primaryPressed' : 'text'}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  stack: { gap: Spacing.two },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  segmentInline: { flex: 1, minHeight: 48, justifyContent: 'center' },
  segmentStacked: { minHeight: 56, justifyContent: 'flex-start' },
});
