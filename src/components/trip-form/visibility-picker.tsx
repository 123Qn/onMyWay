import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Visibility } from '@/lib/trip-form';

const OPTIONS: { value: Visibility; title: string; caption: string }[] = [
  { value: 'public', title: 'Public', caption: 'Everyone on onMyWay can see this trip.' },
  { value: 'private', title: 'Private', caption: 'Only you can see this trip.' },
];

export type VisibilityPickerProps = {
  value: Visibility;
  disabled: boolean;
  onChange: (value: Visibility) => void;
};

export function VisibilityPicker({ value, disabled, onChange }: VisibilityPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      <ThemedText type="small" style={styles.label}>
        Who can see this trip
      </ThemedText>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {OPTIONS.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable collapsable={false}
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={`${o.title}. ${o.caption}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(o.value)}
              style={[
                styles.row,
                {
                  borderColor: selected ? theme.primary : 'transparent',
                  backgroundColor: selected ? theme.primarySoft : theme.surfaceMuted,
                },
              ]}>
              <View style={styles.text}>
                <ThemedText type="bodyStrong">{o.title}</ThemedText>
                <ThemedText type="caption" themeColor="textMuted">
                  {o.caption}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.circle,
                  selected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.borderStrong },
                ]}>
                {selected ? <Icon name="check" size={16} color="onPrimary" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  label: { fontFamily: FontFamily.semibold },
  options: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  text: { flex: 1, gap: Spacing.half },
  circle: {
    width: Layout.iconSize.lg,
    height: Layout.iconSize.lg,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
