import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { TripMapHandle, TripMapProps } from './trip-map.types';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { TripMapHandle, TripMapProps, TripMapStop } from './trip-map.types';

/** react-native-maps has no web support: same props and ref, shows a notice instead. */
export const TripMap = forwardRef<TripMapHandle, TripMapProps>(function TripMap({ height }, ref) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const boxHeight = height ?? Math.max(220, Math.min(320, windowHeight * 0.4));

  useImperativeHandle(ref, () => ({ focusStop: () => {}, fitAll: () => {} }), []);

  return (
    <View
      style={[
        styles.box,
        { height: boxHeight, backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Icon name="map" size={Layout.iconSize.xl} color="primary" />
      <ThemedText themeColor="textMuted" style={styles.text}>
        The route map is available in the mobile app.
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  text: { textAlign: 'center' },
});
