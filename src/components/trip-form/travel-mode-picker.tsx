import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SegmentedControl, type SegmentOption } from '@/components/ui/segmented-control';
import { FontFamily, Spacing } from '@/constants/theme';
import type { TravelMode } from '@/lib/trip-form';

export const TRAVEL_MODE_OPTIONS: SegmentOption<TravelMode>[] = [
  { value: 'driving', label: 'Driving', icon: 'car' },
  { value: 'walking', label: 'Walking', icon: 'walk' },
  { value: 'cycling', label: 'Cycling', icon: 'bike' },
];

export type TravelModePickerProps = {
  value: TravelMode;
  disabled: boolean;
  onChange: (value: TravelMode) => void;
};

export function TravelModePicker({ value, disabled, onChange }: TravelModePickerProps) {
  return (
    <View style={styles.group}>
      <ThemedText type="small" style={styles.label}>
        Travel mode
      </ThemedText>
      <SegmentedControl
        options={TRAVEL_MODE_OPTIONS}
        value={value}
        onChange={onChange}
        disabled={disabled}
        accessibilityLabel="Travel mode"
        accessibilityHint="Used to draw your route between stops"
      />
      <ThemedText type="caption" themeColor="textMuted">
        Used to draw your route along roads and paths between stops.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  label: { fontFamily: FontFamily.semibold },
});
