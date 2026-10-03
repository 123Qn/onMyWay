import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LocationPickerMapHandle, LocationPickerMapProps } from './location-picker-map.types';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { LocationPickerMapHandle, LocationPickerMapProps } from './location-picker-map.types';

/** react-native-maps has no web support: same props and ref, shows a notice instead. */
export const LocationPickerMap = forwardRef<LocationPickerMapHandle, LocationPickerMapProps>(
  function LocationPickerMap(_props, ref) {
    const theme = useTheme();
    useImperativeHandle(ref, () => ({ animateTo: () => {} }), []);

    return (
      <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: theme.background }]}>
        <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Icon name="map" size={Layout.iconSize.xl} color="primary" />
          <ThemedText themeColor="textMuted" style={styles.text}>
            The map is available in the mobile app. Search for a place instead.
          </ThemedText>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  box: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxWidth: 360,
  },
  text: { textAlign: 'center' },
});
