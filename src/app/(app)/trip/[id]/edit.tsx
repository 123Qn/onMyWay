import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, StyleSheet, View } from 'react-native';

import { FormSkeleton } from '@/components/trip-form/form-skeleton';
import { PublishProgress } from '@/components/trip-form/publish-progress';
import { TripForm } from '@/components/trip-form/trip-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { HeaderTextButton } from '@/components/ui/header-text-button';
import { Screen } from '@/components/ui/screen';
import { useSignedUrls } from '@/hooks/use-signed-urls';
import { useTrip, type TripDetail } from '@/hooks/use-trip';
import { useTripForm } from '@/hooks/use-trip-form';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { isRetryable, tripErrorMessage } from '@/lib/trip-errors';
import { emitTripEvent } from '@/lib/trip-events';
import { needsRoute, normalizeForm, type TripFormValues } from '@/lib/trip-form';
import { saveTripEdits, type SaveProgress } from '@/lib/trip-save';
import { removePaths } from '@/lib/trip-storage';
import { useSession } from '@/providers/session-provider';

type Banner = { message: string; retryable: boolean };

function toForm(trip: TripDetail): TripFormValues {
  return {
    title: trip.title,
    description: trip.description ?? '',
    visibility: trip.visibility,
    travelMode: trip.travelMode,
    // The storage path doubles as a stable id for the existing cover.
    cover: trip.coverPath ? { id: trip.coverPath, uri: null, path: trip.coverPath } : null,
    stops: trip.stops.map((s) => ({
      id: s.id,
      name: s.name,
      autoName: s.name,
      notes: s.notes ?? '',
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      photos: s.photos.map((p) => ({ id: p.id, uri: null, path: p.storagePath })),
    })),
  };
}

export default function EditTripScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');
  const { trip, status, isOwner, retry } = useTrip(id);

  const backHeader = (
    <Stack.Screen
      options={{
        gestureEnabled: false,
        headerLeft: () => <HeaderTextButton label="Cancel" tone="neutral" onPress={() => router.back()} />,
        headerRight: () => <HeaderTextButton label="Save" bold disabled onPress={() => {}} />,
      }}
    />
  );

  if (status === 'loading') {
    return (
      <Screen scroll edges={['left', 'right', 'bottom']}>
        {backHeader}
        <FormSkeleton variant="edit" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        {backHeader}
        <ErrorBanner message="Could not load this trip." onRetry={retry} />
      </Screen>
    );
  }

  if (status === 'unavailable' || !trip) {
    return (
      <Screen edges={['left', 'right', 'bottom']} centered>
        {backHeader}
        <EmptyState
          icon="lock"
          title="Trip unavailable"
          message="This trip doesn't exist, was removed, or is private."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen edges={['left', 'right', 'bottom']} centered>
        {backHeader}
        <EmptyState
          icon="lock"
          title="You can't edit this trip"
          message="Only the person who created it can change it."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return <EditTripForm trip={trip} />;
}

/** Mounted once the trip is loaded and owned; later refreshes of `trip` do not reset the form. */
function EditTripForm({ trip }: { trip: TripDetail }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const [initial] = useState(() => {
    const form = toForm(trip);
    return { form, key: normalizeForm(form), coverPath: trip.coverPath };
  });
  const uploaded = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<Banner | null>(null);
  const savingRef = useRef(false);

  const controller = useTripForm({
    initial: initial.form,
    isOwnUpload: (path) => uploaded.current.has(path),
    onOwnUploadRemoved: (path) => uploaded.current.delete(path),
    disabled: saving,
  });
  const { form, formRef } = controller;

  const dirty = useMemo(() => normalizeForm(form) !== initial.key, [form, initial.key]);

  const paths = useMemo(
    () => [
      initial.coverPath,
      ...initial.form.stops.flatMap((s) => s.photos.map((p) => p.path)),
    ],
    [initial],
  );
  const { urls } = useSignedUrls(paths);

  const guard = useUnsavedGuard({
    shouldGuard: () => normalizeForm(formRef.current) !== initial.key,
    onGuard: (proceed) => {
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            // Files uploaded by a failed save would otherwise be orphaned.
            void removePaths([...uploaded.current]);
            proceed();
          },
        },
      ]);
    },
  });
  const { leavingRef, busyRef } = guard;

  useEffect(() => {
    busyRef.current = saving;
  }, [busyRef, saving]);

  useEffect(() => {
    if (!saving) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [saving]);

  const save = async () => {
    if (savingRef.current || !userId) return;
    Keyboard.dismiss();
    if (!controller.validate()) return;
    savingRef.current = true;
    setSaving(true);
    setBanner(null);
    setSaveLabel(undefined);

    const onProgress = (p: SaveProgress) => {
      setSaveLabel(
        p.step === 'photos' && p.total > 0
          ? `Uploading photos ${p.done} of ${p.total}`
          : p.step === 'route'
            ? 'Calculating route...'
            : 'Saving changes...',
      );
    };
    const result = await saveTripEdits({
      userId,
      tripId: trip.id,
      initialCoverPath: initial.coverPath,
      initialTrip: {
        title: trip.title,
        description: trip.description,
        visibility: trip.visibility,
        travelMode: trip.travelMode,
      },
      routeNeeded: needsRoute(initial.form, formRef.current, trip.route?.status ?? null),
      form: formRef.current,
      uploadedThisAttempt: uploaded.current,
      onProgress,
      onFormPatch: controller.applyPaths,
    });

    if (result.ok) {
      leavingRef.current = true;
      emitTripEvent({ type: 'updated', id: trip.id });
      router.back();
      return;
    }
    if (result.discarded && result.discarded.length > 0) controller.discardPaths(result.discarded);
    setBanner({
      message: tripErrorMessage(result.kind, result.uploading),
      retryable: isRetryable(result.kind),
    });
    controller.scroll.scrollRef.current?.scrollTo({ y: 0, animated: true });
    savingRef.current = false;
    setSaving(false);
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerLeft: () => (
            <HeaderTextButton label="Cancel" tone="neutral" disabled={saving} onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderTextButton
              label="Save"
              bold
              loading={saving}
              disabled={!dirty}
              onPress={() => void save()}
            />
          ),
        }}
      />
      <Screen scroll scrollRef={controller.scroll.scrollRef} edges={['left', 'right', 'bottom']}>
        <TripForm
          mode="edit"
          form={form}
          actions={controller.actions}
          scroll={controller.scroll}
          errors={controller.errors}
          remoteUrls={urls}
          disabled={saving}
          picking={controller.picking}
          notice={controller.notice}
          onDismissNotice={controller.dismissNotice}
          banner={
            banner ? (
              <ErrorBanner
                message={banner.message}
                onRetry={banner.retryable ? () => void save() : undefined}
                retrying={saving}
              />
            ) : null
          }
          submit={{
            label: 'Save changes',
            loading: saving,
            disabled: !dirty,
            onPress: () => void save(),
          }}
        />
      </Screen>
      {saving ? <PublishProgress variant="save" label={saveLabel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
