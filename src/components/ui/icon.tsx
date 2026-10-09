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
  | 'image'
  | 'check'
  | 'more'
  | 'directions'
  | 'search'
  | 'locate'
  | 'pin'
  | 'arrow-up'
  | 'arrow-down'
  | 'trash'
  | 'edit'
  | 'route'
  | 'calendar'
  | 'camera'
  | 'car'
  | 'walk'
  | 'bike';

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
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  more: { ios: 'ellipsis', android: 'more_vert', web: 'more_vert' },
  directions: {
    ios: 'arrow.triangle.turn.up.right.diamond',
    android: 'directions',
    web: 'directions',
  },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  locate: { ios: 'location', android: 'my_location', web: 'my_location' },
  pin: { ios: 'mappin', android: 'location_on', web: 'location_on' },
  'arrow-up': { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  'arrow-down': { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  route: {
    ios: 'point.topleft.down.curvedto.point.bottomright.up',
    android: 'route',
    web: 'route',
  },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  car: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  walk: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  bike: { ios: 'bicycle', android: 'directions_bike', web: 'directions_bike' },
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
