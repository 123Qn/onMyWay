import { useRef } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  appleDirectionsUrl,
  dedupeConsecutive,
  googleDirectionsUrl,
  splitIntoLegs,
  GOOGLE_MAX_POINTS,
  type MapPoint,
} from '@/lib/maps-links';

export type FollowStop = MapPoint & { number: number };

export type FollowTripButtonProps = {
  /** Sorted in route order. */
  stops: FollowStop[];
  /** Called when no maps app could open the route. */
  onOpenError: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const DOUBLE_TAP_MS = 500;

async function openUrl(url: string, onError: () => void) {
  try {
    // No canOpenURL gate: it returns false for https on Android 11+ without a <queries> entry.
    await Linking.openURL(url);
  } catch {
    onError();
  }
}

type Provider = 'google' | 'apple';

/** Sticky bottom bar with the "Follow this trip" button and the maps / part pickers. */
export function FollowTripButton({ stops, onOpenError, onLayout }: FollowTripButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lastTapRef = useRef(0);

  const follow = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) return;
    lastTapRef.current = now;

    // Skip consecutive duplicates; fewer than 2 distinct points = single destination.
    const distinct = dedupeConsecutive(stops);
    const route = distinct.length >= 2 ? distinct : distinct.slice(0, 1);
    if (route.length === 0) return;
    const legs = splitIntoLegs(route, GOOGLE_MAX_POINTS);

    const openLeg = (provider: Provider, leg: FollowStop[]) => {
      const url = provider === 'google' ? googleDirectionsUrl(leg) : appleDirectionsUrl(leg);
      void openUrl(url, onOpenError);
    };

    const choosePart = (provider: Provider) => {
      if (legs.length <= 1) {
        openLeg(provider, legs[0]);
        return;
      }
      const labels = legs.map((leg, i) => `Part ${i + 1}: stops ${leg[0].number}-${leg[leg.length - 1].number}`);
      const title = 'Choose a part';
      const message = `Maps can show up to ${GOOGLE_MAX_POINTS} stops at a time. Part 2 starts where part 1 ends.`;
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title, message, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
          (index) => {
            if (index < legs.length) openLeg(provider, legs[index]);
          },
        );
      } else {
        // Android alerts hold 3 buttons; the 20-stop cap gives at most 2 parts + Cancel.
        Alert.alert(title, message, [
          ...labels.map((text, i) => ({ text, onPress: () => openLeg(provider, legs[i]) })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
    };

    if (Platform.OS === 'ios') {
      const apple = route.length === 1 ? 'Apple Maps' : 'Apple Maps (start and end only)';
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Follow this trip',
          message: 'Open the route in:',
          options: ['Google Maps', apple, 'Cancel'],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) choosePart('google');
          else if (index === 1) choosePart('apple');
        },
      );
    } else {
      choosePart('google');
    }
  };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, Spacing.three),
        },
      ]}>
      <Button
        title="Follow this trip"
        icon="directions"
        size="lg"
        fullWidth
        disabled={stops.length === 0}
        onPress={follow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.three,
    borderTopWidth: 1,
  },
});
