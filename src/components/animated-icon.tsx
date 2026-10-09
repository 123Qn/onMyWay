import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Duration } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Plain `background`-coloured cover that hands off from the native splash screen: it appears
 * under the splash, the splash is hidden once it is laid out, then the cover fades out.
 */
export function AnimatedSplashOverlay() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const [visible, setVisible] = useState(true);
  const started = useRef(false);

  const hide = useCallback(() => setVisible(false), []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  const onLayout = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().finally(() => {
      opacity.value = withTiming(
        0,
        { duration: reduceMotion ? 0 : Duration.normal },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(hide);
        },
      );
    });
  };

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[styles.overlay, { backgroundColor: theme.background }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
});
