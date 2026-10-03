import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Layout, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName =
  | 'eye'
  | 'eye-off'
  | 'plus'
  | 'close'
  | 'chevron-right'
  | 'alert'
  | 'refresh'
  | 'map'
  | 'home'
  | 'person'
  | 'lock'
  | 'image';

type SymbolName = Exclude<ComponentProps<typeof SymbolView>['name'], string>;

/** SF Symbols on iOS, Material Symbols on Android/web. */
const ICONS: Record<IconName, Required<SymbolName>> = {
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  'eye-off': { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  alert: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  map: { ios: 'map', android: 'map', web: 'map' },
  home: { ios: 'house', android: 'home', web: 'home' },
  person: { ios: 'person', android: 'person', web: 'person' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  image: { ios: 'photo', android: 'image', web: 'image' },
};

export type IconProps = {
  name: IconName;
  size?: number;
  color?: ThemeColor | (string & {});
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = Layout.iconSize.lg, color = 'text', style }: IconProps) {
  const theme = useTheme();
  const tint = color in Colors.light ? theme[color as ThemeColor] : color;

  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={tint}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}
