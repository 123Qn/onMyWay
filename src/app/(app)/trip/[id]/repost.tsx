import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TripCard } from '@/components/trip/trip-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { HeaderTextButton } from '@/components/ui/header-text-button';
import { Screen } from '@/components/ui/screen';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { ToastHost } from '@/components/ui/toast-host';
import { Radius, Spacing } from '@/constants/theme';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTripPreview } from '@/hooks/use-trip-preview';
import { useTripSocialInfo } from '@/hooks/use-trip-social-info';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { createRepost } from '@/lib/social-api';
import { SocialError, TOAST_RATE_LIMITED, TOAST_TRIP_PRIVATE } from '@/lib/social-errors';
import { emitSocialEvent, updateTripSocial } from '@/lib/social-store';
import { showToast } from '@/lib/toast';
import { emitTripEvent } from '@/lib/trip-events';
import { COLLAPSED, collapsedA11y } from '@/lib/collapse';

const MAX_CAPTION = 280;
const COUNTER_FROM = 220;
const EDGES = ['left', 'right', 'bottom'] as const;
const noop = () => {};

function RepostBody() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');
  const stackOptions = useStackScreenOptions();
  const preview = useTripPreview(id);
  const info = useTripSocialInfo(id);

  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const captionRef = useRef('');
  const postingRef = useRef(false);

  const { busyRef, leavingRef } = useUnsavedGuard({
    shouldGuard: () => captionRef.current.trim().length > 0,
    onGuard: (proceed) => {
      Alert.alert('Discard caption?', undefined, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: proceed },
      ]);
    },
  });

  const onChangeCaption = (text: string) => {
    captionRef.current = text;
    setCaption(text);
  };

  const submit = async () => {
    if (postingRef.current) return;
    postingRef.current = true;
    busyRef.current = true;
    setPosting(true);
    setErrorMessage(null);
    const trimmed = caption.trim();
    try {
      // A repeat of an existing repost comes back as success from the server.
      const result = await createRepost(id, trimmed.length > 0 ? trimmed : null);
      updateTripSocial(id, {
        reposted: true,
        repostId: result.repostId,
        repostCount: result.repostCount,
      });
      emitSocialEvent({ type: 'repost-created', tripId: id });
      busyRef.current = false;
      leavingRef.current = true;
      router.back();
      showToast('Reposted to your feed');
    } catch (error) {
      busyRef.current = false;
      postingRef.current = false;
      setPosting(false);
      const kind = error instanceof SocialError ? error.kind : 'other';
      if (kind === 'trip_unavailable') {
        emitTripEvent({ type: 'visibility', id, visibility: 'private' });
        leavingRef.current = true;
        router.back();
        showToast(TOAST_TRIP_PRIVATE);
      } else if (kind === 'rate_limited') {
        setErrorMessage(TOAST_RATE_LIMITED);
      } else {
        setErrorMessage("Couldn't repost. Try again.");
      }
    }
  };

  const cancel = () => router.back();

  const header = (
    <Stack.Screen
      options={{
        ...stackOptions,
        title: 'Repost',
        headerLeft: () => (
          <HeaderTextButton label="Cancel" tone="neutral" disabled={posting} onPress={cancel} />
        ),
        headerRight: () => (
          <HeaderTextButton label="Repost" bold loading={posting} onPress={() => void submit()} />
        ),
      }}
    />
  );

  const unavailable =
    preview.status === 'unavailable' ||
    info.status === 'unavailable' ||
    (preview.trip !== null && !preview.trip.isPublic);

  if (preview.status === 'loading' || info.status === 'loading') {
    return (
      <Screen edges={[...EDGES]}>
        {header}
        <SkeletonGroup>
          <Skeleton height={200} radius={Radius.lg} />
        </SkeletonGroup>
      </Screen>
    );
  }

  if (unavailable) {
    return (
      <Screen edges={[...EDGES]} centered>
        {header}
        <EmptyState
          icon="lock"
          title="Trip unavailable"
          message="This trip doesn't exist, was removed, or is private."
          actionLabel="Go back"
          onAction={cancel}
        />
      </Screen>
    );
  }

  if (preview.status === 'error' || info.status === 'error' || !preview.trip) {
    return (
      <Screen edges={[...EDGES]}>
        {header}
        <ErrorBanner
          message="Couldn't load this trip."
          onRetry={() => {
            info.reload();
          }}
        />
      </Screen>
    );
  }

  if (!info.canRepost) {
    return (
      <Screen edges={[...EDGES]} centered>
        {header}
        <EmptyState
          icon="repost"
          title="Can't repost this trip"
          message="You can't repost your own trips."
          actionLabel="Go back"
          onAction={cancel}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={[...EDGES]}>
      {header}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <TripCard trip={preview.trip} variant="embedded" onPress={noop} onCoverError={preview.retryCover} />
      </View>
      <TextField
        label="Caption"
        variant="onCard"
        value={caption}
        onChangeText={onChangeCaption}
        placeholder="Add a caption (optional)"
        multiline
        maxLength={MAX_CAPTION}
        showCounter={caption.length >= COUNTER_FROM}
        editable={!posting}
      />
      <View collapsable={false} {...collapsedA11y(!errorMessage)} style={errorMessage ? undefined : styles.none}>
        <ErrorBanner message={errorMessage ?? ''} onRetry={() => void submit()} retrying={posting} />
      </View>
      <Button
        title="Repost"
        size="lg"
        fullWidth
        loading={posting}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </Screen>
  );
}

export default function RepostScreen() {
  return (
    <>
      <RepostBody />
      <ToastHost bottomOffset={Spacing.four} />
    </>
  );
}

const styles = StyleSheet.create({
  // Collapsed (see lib/collapse); cancels the Screen gap.
  none: { ...COLLAPSED, marginBottom: -Spacing.three },
  submit: { marginTop: Spacing.two },
});
