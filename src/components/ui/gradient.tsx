import type { LinearGradient as LinearGradientType } from 'expo-linear-gradient';
import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { GradientSpec } from '@/constants/theme';
import { hasNativeModule } from '@/lib/native-module';

export type GradientProps = Partial<GradientSpec> & {
  colors: GradientSpec['colors'];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// Resolved lazily so a dev build without the native module renders a solid colour instead of
// crashing. Rebuild the dev build to see real gradients.
const LinearGradient: ComponentType<React.ComponentProps<typeof LinearGradientType>> | null =
  hasNativeModule('ExpoLinearGradient')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-linear-gradient').LinearGradient as typeof LinearGradientType)
    : null;

/** Decorative gradient fill. Wraps expo-linear-gradient; see Gradients in the theme. */
export function Gradient({ colors, locations, start, end, style, testID }: GradientProps) {
  if (!LinearGradient) {
    const mid = colors[Math.floor(colors.length / 2)];
    return (
      <View
        testID={testID}
        accessible={false}
        pointerEvents="none"
        style={[{ backgroundColor: mid }, style]}
      />
    );
  }

  return (
    <LinearGradient
      testID={testID}
      accessible={false}
      pointerEvents="none"
      colors={colors}
      locations={locations}
      start={start}
      end={end}
      style={style}
    />
  );
}
