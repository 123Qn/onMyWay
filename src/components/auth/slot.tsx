import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { COLLAPSED, collapsedA11y } from '@/lib/collapse';

type SlotProps = {
  visible: boolean;
  children: ReactNode;
  /** Gap of the parent column; cancelled while collapsed. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** Announce content changes (error containers). */
  live?: boolean;
};

/**
 * Always-mounted slot of an auth column. Hidden slots collapse to zero size instead of being
 * removed or set to display:none, so sibling order never changes (Android Fabric rule).
 */
export function Slot({ visible, children, gap = Spacing.three, style, live = false }: SlotProps) {
  return (
    <View
      collapsable={false}
      accessibilityLiveRegion={live ? 'polite' : undefined}
      {...collapsedA11y(!visible)}
      style={visible ? style : { ...COLLAPSED, marginBottom: -gap }}>
      {children}
    </View>
  );
}
