import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, TabBar } from '@/constants/theme';

/** Distance from the screen bottom to the floating tab bar's bottom edge. */
export function useTabBarBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 8, TabBar.bottomMin);
}

/** Bottom padding that keeps tab-screen content clear of the floating tab bar and its "+". */
export function useTabBarInset(): number {
  const offset = useTabBarBottomOffset();
  // Web uses a top tab list, so nothing floats at the bottom.
  if (Platform.OS === 'web') return 0;
  return TabBar.height + offset + TabBar.fabLift + Spacing.two;
}
