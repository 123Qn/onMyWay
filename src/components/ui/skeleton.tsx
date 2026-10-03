import { useEffect, type ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  shape?: 'rect' | 'circle' | 'text';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Skeleton({
  width = '100%',
  height = 16,
  shape = 'rect',
  radius,
  style,
  testID,
}: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const { skeleton, skeletonHighlight } = theme;

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: Duration.pulse }),
        withTiming(0, { duration: Duration.pulse }),
      ),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [skeleton, skeletonHighlight]),
  }));

  const h = shape === 'text' ? 16 : height;
  const w = shape === 'circle' ? height : width;
  const r = radius ?? (shape === 'circle' ? Radius.full : Radius.sm);

  return (
    <Animated.View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: w, height: h, borderRadius: r, backgroundColor: skeleton },
        reduceMotion ? null : animatedStyle,
        style,
      ]}
    />
  );
}

export type SkeletonGroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SkeletonGroup({ children, style, testID }: SkeletonGroupProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={style}>
      {children}
    </View>
  );
}
