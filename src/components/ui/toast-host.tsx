import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import {
  allocateToastHostId,
  getActiveToastHost,
  getToast,
  registerToastHost,
  subscribeToast,
  subscribeToastHosts,
} from '@/lib/toast';

type Props = {
  /** Distance from the bottom edge. Defaults to the clearance above the floating tab bar. */
  bottomOffset?: number;
};

/**
 * Renders the current toast. Mount one in the app layout; a modal that covers it mounts its
 * own, and only the most recently mounted host draws. The view stays mounted and only its
 * opacity and text change (no views inserted or removed on Android).
 */
export function ToastHost({ bottomOffset }: Props) {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast);
  const activeHost = useSyncExternalStore(subscribeToastHosts, getActiveToastHost, getActiveToastHost);
  const [hostId] = useState(allocateToastHostId);
  const [lastMessage, setLastMessage] = useState('');

  useEffect(() => registerToastHost(hostId), [hostId]);

  if (toast && toast.message !== lastMessage) setLastMessage(toast.message);

  const visible = !!toast && activeHost === hostId;
  const bottom = bottomOffset ?? Math.max(tabInset, insets.bottom + Spacing.three);

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[styles.wrap, { bottom, opacity: visible ? 1 : 0 }]}>
      <View
        collapsable={false}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
        style={[styles.toast, { backgroundColor: theme.text }]}>
        <ThemedText type="small" style={{ color: theme.background }}>
          {lastMessage}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 420,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.lg,
  },
});
