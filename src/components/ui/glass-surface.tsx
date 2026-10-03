import type { BlurView as BlurViewType } from 'expo-blur';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useIsDark } from '@/hooks/use-is-dark';
import { useTheme } from '@/hooks/use-theme';
import { hasNativeModule } from '@/lib/native-module';

export type GlassSurfaceProps = {
  children?: ReactNode;
  /** Blur strength 0-100. */
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// Blur is iOS-only (Android blur is experimental and costs frames; web uses solid). Resolved
// lazily so a dev build without ExpoBlur falls back to the solid surface instead of crashing.
const NativeBlur: typeof BlurViewType | null =
  Platform.OS === 'ios' && hasNativeModule('ExpoBlur')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-blur').BlurView as typeof BlurViewType)
    : null;

function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((v) => active && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Frosted surface (iOS blur) with a solid fallback elsewhere or with Reduce Transparency on. */
export function GlassSurface({
  children,
  intensity = 70,
  radius = Radius.full,
  style,
  testID,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const isDark = useIsDark();
  const reduceTransparency = useReduceTransparency();
  const BlurView = reduceTransparency ? null : NativeBlur;

  const frame = { borderRadius: radius, borderColor: theme.glassBorder };

  if (!BlurView) {
    return (
      <View
        testID={testID}
        style={[styles.base, frame, { backgroundColor: theme.glassSolid }, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView
      testID={testID}
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.base, frame, style]}>
      <View
        pointerEvents="none"
        accessible={false}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.glassFill }]}
      />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', borderWidth: 1 },
});
