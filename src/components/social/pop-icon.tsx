import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/icon';
import { Duration, type ThemeColor } from '@/constants/theme';

type Props = {
  name: IconName;
  filled: boolean;
  size: number;
  color: ThemeColor;
};

/**
 * Glyph that pops (1 -> 1.25 -> 1) when it turns on. The wrapper is always mounted and only
 * its transform changes, so no view is inserted or removed on a toggle. Reduce motion: no pop.
 */
export function PopIcon({ name, filled, size, color }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const wasFilled = useRef(filled);

  useEffect(() => {
    // Pop only on a real off -> on change, not when a card mounts already liked.
    const turnedOn = filled && !wasFilled.current;
    wasFilled.current = filled;
    if (!turnedOn || reduceMotion) return;
    const easing = Easing.out(Easing.cubic);
    scale.value = withSequence(
      withTiming(1.25, { duration: Duration.fast, easing }),
      withTiming(1, { duration: Duration.fast, easing }),
    );
  }, [filled, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View collapsable={false} style={style}>
      <Icon name={name} size={size} color={color} filled={filled} />
    </Animated.View>
  );
}
