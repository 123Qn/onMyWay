import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing, shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PublishProgress as Progress, PublishStep } from '@/lib/trip-publish';

export type PublishFailure = {
  step: PublishStep;
  message: string;
  canRetry: boolean;
};

export type PublishProgressProps = {
  variant: 'publish' | 'save' | 'discard';
  /** Current step; null before the first report. */
  progress?: Progress | null;
  /** Upload counter of this attempt; null/zero total hides the photos row and bar. */
  photos?: { done: number; total: number } | null;
  /** False hides the "Calculating route" row (fewer than 2 distinct stops). */
  routing?: boolean;
  failure?: PublishFailure | null;
  /** Save variant: current label, e.g. "Uploading photos 2 of 5". */
  label?: string;
  onRetry?: () => void;
  onBack?: () => void;
  onDiscard?: () => void;
};

const STEPS: { step: PublishStep; label: string }[] = [
  { step: 'trip', label: 'Creating your trip' },
  { step: 'photos', label: 'Uploading photos' },
  { step: 'stops', label: 'Saving stops' },
  { step: 'route', label: 'Calculating route' },
  { step: 'finish', label: 'Finishing up' },
];

type Status = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

const ROUTE_SKIPPED_DETAIL = 'Straight lines used';

/** Blocking overlay used while publishing, saving edits or discarding a half-published trip. */
export function PublishProgress({
  variant,
  progress,
  photos = null,
  routing = false,
  failure,
  label,
  onRetry,
  onBack,
  onDiscard,
}: PublishProgressProps) {
  const theme = useTheme();
  const simple = variant !== 'publish';
  const simpleLabel =
    variant === 'discard' ? 'Discarding...' : (label ?? 'Saving changes...');
  const showPhotos = !!photos && photos.total > 0;
  const steps = STEPS.filter(
    (s) => (s.step !== 'photos' || showPhotos) && (s.step !== 'route' || routing),
  );
  const routeFailed = !!progress?.route && progress.route.status !== 'ok';
  const order = STEPS.map((s) => s.step);
  const current = failure?.step ?? progress?.step ?? 'trip';

  const statusOf = (step: PublishStep): Status => {
    const i = order.indexOf(step);
    const c = order.indexOf(current);
    if (failure && step === failure.step) return 'failed';
    if (i < c) return step === 'route' && routeFailed ? 'skipped' : 'done';
    if (i === c) return 'active';
    return 'pending';
  };

  const activeLabel = STEPS.find((s) => s.step === current)?.label ?? '';

  return (
    <View
      accessibilityViewIsModal
      onStartShouldSetResponder={() => true}
      style={[styles.scrim, { backgroundColor: theme.overlay }]}>
      <View style={[styles.card, { backgroundColor: theme.surface }, shadow(theme, 'lg')]}>
        {simple ? (
          <View style={styles.simple} accessibilityLiveRegion="polite">
            <ActivityIndicator />
            <ThemedText type="bodyStrong">{simpleLabel}</ThemedText>
          </View>
        ) : (
          <>
            <ThemedText type="heading" accessibilityRole="header">
              Publishing your trip
            </ThemedText>
            {/* One announcement per step; photo progress is exposed through the bar's value. */}
            <ThemedText accessibilityLiveRegion="polite" style={styles.hidden}>
              {failure ? failure.message : activeLabel}
            </ThemedText>
            <View style={styles.list}>
              {steps.map((s) => {
                const status = statusOf(s.step);
                const isPhotos = s.step === 'photos';
                const total = isPhotos ? (photos?.total ?? 0) : 0;
                const done = isPhotos ? (photos?.done ?? 0) : 0;
                const skipped = status === 'skipped';
                return (
                  <View key={s.step}>
                    <View
                      collapsable={false}
                      style={styles.row}
                      accessible={skipped}
                      accessibilityLabel={skipped ? `${s.label}. ${ROUTE_SKIPPED_DETAIL}.` : undefined}>
                      <View style={styles.statusIcon}>
                        {status === 'active' ? (
                          <ActivityIndicator size="small" />
                        ) : status === 'done' ? (
                          <Icon name="check" size={Layout.iconSize.md} color="success" />
                        ) : skipped ? (
                          <Icon name="alert" size={Layout.iconSize.md} color="textMuted" />
                        ) : status === 'failed' ? (
                          <Icon name="alert" size={Layout.iconSize.md} color="danger" />
                        ) : (
                          <View style={[styles.pending, { borderColor: theme.borderStrong }]} />
                        )}
                      </View>
                      <ThemedText
                        themeColor={status === 'failed' ? 'danger' : status === 'pending' ? 'textMuted' : 'text'}
                        style={styles.flex}>
                        {s.label}
                      </ThemedText>
                      {isPhotos && total > 0 ? (
                        <ThemedText type="caption" themeColor="textMuted">
                          {`${done} of ${total}`}
                        </ThemedText>
                      ) : null}
                      {skipped ? (
                        <ThemedText type="caption" themeColor="textMuted">
                          {ROUTE_SKIPPED_DETAIL}
                        </ThemedText>
                      ) : null}
                    </View>
                    {isPhotos && total > 0 ? (
                      <View
                        accessibilityRole="progressbar"
                        accessibilityValue={{ min: 0, max: total, now: done }}
                        style={[styles.bar, { backgroundColor: theme.border }]}>
                        <View
                          style={[
                            styles.barFill,
                            { backgroundColor: theme.primary, width: `${(done / total) * 100}%` },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {failure ? (
              <View style={styles.failure}>
                <ThemedText themeColor="danger">{failure.message}</ThemedText>
                {failure.canRetry && onRetry ? <Button title="Retry" fullWidth onPress={onRetry} /> : null}
                {onBack ? (
                  <Button title="Back to editing" variant="secondary" fullWidth onPress={onBack} />
                ) : null}
                {onDiscard ? (
                  <Button
                    title="Discard trip"
                    variant="ghost"
                    size="sm"
                    onPress={onDiscard}
                    accessibilityHint="Deletes the partly published trip"
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    gap: Spacing.three,
  },
  simple: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  list: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  statusIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  pending: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  flex: { flex: 1 },
  bar: { height: 6, borderRadius: Radius.full, overflow: 'hidden', marginLeft: 32 },
  barFill: { height: 6, borderRadius: Radius.full },
  failure: { gap: Spacing.two, alignItems: 'stretch' },
});
