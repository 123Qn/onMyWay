import { useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { Duration, shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { likeTripOnce } from '@/lib/social-store';

const WINDOW_MS = 300;
const HEART = 64;

/**
 * Transparent layer over the trip cover: two taps within 300 ms like the trip (never unlike)
 * and play a centred heart. A single tap does nothing. It is plain Pressable tap counting, not
 * a gesture detector, so no extra native wrapper view is involved. Hidden from screen readers;
 * the Like button is the accessible path.
 */
export function DoubleTapLike({ tripId }: { tripId: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const lastTap = useRef(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  const play = () => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withSequence(
      withTiming(1, { duration: Duration.fast, easing }),
      withTiming(1, { duration: Duration.normal }),
      withTiming(0, { duration: Duration.slow, easing }),
    );
    if (reduceMotion) return;
    scale.value = 0.6;
    scale.value = withSequence(
      withTiming(1.1, { duration: Duration.fast, easing }),
      withTiming(1, { duration: Duration.fast, easing }),
    );
  };

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current <= WINDOW_MS) {
      lastTap.current = 0;
      likeTripOnce(tripId);
      play();
    } else {
      lastTap.current = now;
    }
  };

  const heartStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: reduceMotion ? 1 : scale.value }],
  }));

  return (
    <>
      <Pressable
        collapsable={false}
        accessible={false}
        importantForAccessibility="no"
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        collapsable={false}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[styles.heart, shadow(theme, 'lg'), heartStyle]}>
        <Icon name="heart" filled size={HEART} color="onImage" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  heart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: HEART,
    height: HEART,
    marginLeft: -HEART / 2,
    marginTop: -HEART / 2,
  },
});
