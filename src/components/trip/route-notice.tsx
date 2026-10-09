import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Layout, Spacing } from '@/constants/theme';
import type { TravelMode } from '@/lib/trip-form';
import { computeTripRoute, type RouteReason, type RouteStatus } from '@/lib/trip-route';

export type RouteNoticeProps = {
  /** Only 'error' and 'none' show a notice. */
  status: RouteStatus;
  reason: RouteReason | null;
  travelMode: TravelMode;
  tripId: string;
  /** Re-reads the stored route after a "Try again" that got an answer. */
  onRecomputed: () => Promise<void>;
  onEdit: () => void;
};

const MODE_WORD: Record<TravelMode, string> = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'cycling',
};

/** Owner-only information card above the map when the road route could not be drawn. */
export function RouteNotice({
  status,
  reason,
  travelMode,
  tripId,
  onRecomputed,
  onEdit,
}: RouteNoticeProps) {
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const runningRef = useRef(false);

  const tryAgain = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setFailed(false);
    const outcome = await computeTripRoute(tripId);
    if (outcome.status === 'error') {
      setFailed(true);
    } else {
      await onRecomputed();
    }
    runningRef.current = false;
    setRunning(false);
  };

  const message =
    status === 'error'
      ? "We couldn't reach the route service, so lines connect your stops in a straight line for now."
      : reason === 'too_far'
        ? `These stops are too far apart for a ${MODE_WORD[travelMode]} route, so lines connect them in a straight line.`
        : "There's no road route between some of your stops, so lines connect them in a straight line.";

  return (
    <Card variant="flat" padding={Spacing.three}>
      <View collapsable={false} style={styles.row}>
        <Icon name="alert" size={Layout.iconSize.md} color="textMuted" />
        <ThemedText accessibilityRole="text" style={styles.flex}>
          {message}
        </ThemedText>
      </View>
      {status === 'error' ? (
        <>
          {failed ? (
            <ThemedText
              type="caption"
              themeColor="textMuted"
              accessibilityLiveRegion="polite"
              style={styles.action}>
              Still can&apos;t reach the route service. Try again later.
            </ThemedText>
          ) : null}
          <Button
            title="Try again"
            variant="secondary"
            size="sm"
            loading={running}
            onPress={() => void tryAgain()}
            style={styles.action}
          />
        </>
      ) : (
        <Button title="Edit trip" variant="ghost" size="sm" onPress={onEdit} style={styles.action} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  flex: { flex: 1 },
  action: { alignSelf: 'flex-start', marginTop: Spacing.two },
});
